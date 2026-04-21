import {
  categorizeVoter,
  EPOCHS,
  GRANTEE_POOL_SHARE,
  SECONDS_IN_MONTH,
  MENTOR_VOTERS,
  MENTOR_NAMES,
  MENTOR_EPOCH_VOTING_POWER,
} from "./constants";
import { weiPerSecToPerMonth } from "./utils";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  VotingEventRow,
  FundingPeriodRow,
  TimeSeriesPoint,
  ProjectEpochData,
  ApplicationData,
  MentorVoterData,
} from "@/types";

type AddressNameMap = Map<string, string>;

export type RecipientRemovalMap = Map<string, number | null>;

export type TimeSeries = {
  fundingRateSeries: TimeSeriesPoint[];
  cumulativeSeries: TimeSeriesPoint[];
  fundersSeries: TimeSeriesPoint[];
  votersSeries: TimeSeriesPoint[];
  totalRateSeries: TimeSeriesPoint[];
  totalCumulativeSeries: TimeSeriesPoint[];
};

export function buildAddressNameMap(
  applications: ApplicationData[],
): AddressNameMap {
  const map = new Map<string, string>();
  for (const app of applications) {
    if (app.project_name) {
      map.set(app.funding_address.toLowerCase(), app.project_name);
    }
  }
  return map;
}

export function processVotingEvents(
  ballots: SubgraphBallot[],
  nameMap: AddressNameMap,
  recipientRemovalMap: RecipientRemovalMap,
): VotingEventRow[] {
  const rows: VotingEventRow[] = [];

  for (const ballot of ballots) {
    if (ballot.votes.length === 0) continue;
    const voterAddress = ballot.votes[0].votedBy.toLowerCase();
    const timestamp = Number(ballot.createdAtTimestamp);

    for (const vote of ballot.votes) {
      if (BigInt(vote.amount) === 0n) continue;
      const granteeAddress = vote.recipient.account.toLowerCase();
      rows.push({
        voterAddress,
        voterType: categorizeVoter(voterAddress),
        granteeName: nameMap.get(granteeAddress) ?? granteeAddress,
        granteeAddress,
        totalVotes: BigInt(vote.amount),
        submissionTimestamp: timestamp,
        replacedTimestamp: null,
      });
    }
  }

  const byVoter = new Map<string, VotingEventRow[]>();
  for (const row of rows) {
    let group = byVoter.get(row.voterAddress);
    if (!group) {
      group = [];
      byVoter.set(row.voterAddress, group);
    }
    group.push(row);
  }

  for (const voterRows of byVoter.values()) {
    voterRows.sort((a, b) => a.submissionTimestamp - b.submissionTimestamp);

    // Each ballot (group of rows sharing a timestamp) is replaced by the next
    // ballot from the same voter. Walk right-to-left so we know the next ts.
    let nextTs: number | null = null;
    let end = voterRows.length;
    while (end > 0) {
      const currentTs = voterRows[end - 1].submissionTimestamp;
      let start = end - 1;
      while (
        start > 0 &&
        voterRows[start - 1].submissionTimestamp === currentTs
      ) {
        start--;
      }
      for (let j = start; j < end; j++) {
        voterRows[j].replacedTimestamp = nextTs;
      }
      nextTs = currentTs;
      end = start;
    }

    for (const row of voterRows) {
      const removalTs = recipientRemovalMap.get(row.granteeAddress);
      if (removalTs != null && removalTs > row.submissionTimestamp) {
        if (
          row.replacedTimestamp === null ||
          removalTs < row.replacedTimestamp
        ) {
          row.replacedTimestamp = removalTs;
        }
      }
    }
  }

  return rows.sort((a, b) => b.submissionTimestamp - a.submissionTimestamp);
}

export function processStreamPeriods(
  events: FlowUpdatedEvent[],
): FundingPeriodRow[] {
  const periods: FundingPeriodRow[] = [];
  const openPeriods = new Map<string, FundingPeriodRow>();

  const sorted = [...events].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp),
  );

  for (const event of sorted) {
    const sender = event.sender.toLowerCase();
    const timestamp = Number(event.timestamp);
    const newRate = BigInt(event.flowRate);

    const existing = openPeriods.get(sender);
    if (existing) {
      existing.endTime = timestamp;
      existing.cumulativeFunding =
        existing.fundingRateWeiPerSec * BigInt(timestamp - existing.startTime);
      openPeriods.delete(sender);
    }

    if (newRate > 0n) {
      const period: FundingPeriodRow = {
        funderAddress: sender,
        fundingRateWeiPerSec: newRate,
        fundingRatePerMonth: weiPerSecToPerMonth(newRate),
        startTime: timestamp,
        endTime: null,
        cumulativeFunding: 0n,
      };
      openPeriods.set(sender, period);
      periods.push(period);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  for (const period of openPeriods.values()) {
    period.cumulativeFunding =
      period.fundingRateWeiPerSec * BigInt(now - period.startTime);
  }

  return periods.sort((a, b) => b.startTime - a.startTime);
}

type TimelineEvent =
  | { type: "ballot"; timestamp: number; ballot: SubgraphBallot }
  | { type: "flow"; timestamp: number; sender: string; flowRate: bigint };

const TIMELINE_TYPE_ORDER: Record<TimelineEvent["type"], number> = {
  ballot: 0,
  flow: 1,
};

function buildTimeline(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  for (const ballot of ballots) {
    timeline.push({
      type: "ballot",
      timestamp: Number(ballot.createdAtTimestamp),
      ballot,
    });
  }
  for (const fe of flowEvents) {
    timeline.push({
      type: "flow",
      timestamp: Number(fe.timestamp),
      sender: fe.sender.toLowerCase(),
      flowRate: BigInt(fe.flowRate),
    });
  }
  timeline.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return TIMELINE_TYPE_ORDER[a.type] - TIMELINE_TYPE_ORDER[b.type];
  });
  return timeline;
}

function sortedRemovalList(
  recipientRemovalMap: RecipientRemovalMap,
): Array<{ recipient: string; timestamp: number }> {
  const list: Array<{ recipient: string; timestamp: number }> = [];
  for (const [addr, ts] of recipientRemovalMap) {
    if (ts != null) list.push({ recipient: addr, timestamp: ts });
  }
  list.sort((a, b) => a.timestamp - b.timestamp);
  return list;
}

type IncrementalState = {
  voterAllocations: Map<string, Map<string, bigint>>;
  recipientTotals: Map<string, bigint>;
  grandTotal: bigint;
  removedRecipients: Set<string>;
  activeSenders: Map<string, bigint>;
  totalPoolFlowRate: bigint;
  allVoters: Set<string>;
  // Prevents a duplicate (voter, timestamp) ballot pair from overwriting the
  // first ballot's allocations. Matches the "earliest wins at same timestamp"
  // semantic of the previous reconstruction-based algorithm.
  voterLastAppliedTs: Map<string, number>;
};

function newState(): IncrementalState {
  return {
    voterAllocations: new Map(),
    recipientTotals: new Map(),
    grandTotal: 0n,
    removedRecipients: new Set(),
    activeSenders: new Map(),
    totalPoolFlowRate: 0n,
    allVoters: new Set(),
    voterLastAppliedTs: new Map(),
  };
}

function applyBallot(state: IncrementalState, ballot: SubgraphBallot): void {
  if (ballot.votes.length === 0) return;
  const voter = ballot.votes[0].votedBy.toLowerCase();
  const ts = Number(ballot.createdAtTimestamp);
  state.allVoters.add(voter);
  if (state.voterLastAppliedTs.get(voter) === ts) return;
  state.voterLastAppliedTs.set(voter, ts);

  const oldAllocs = state.voterAllocations.get(voter);
  if (oldAllocs) {
    for (const [rec, amount] of oldAllocs) {
      const newTotal = (state.recipientTotals.get(rec) ?? 0n) - amount;
      if (newTotal <= 0n) state.recipientTotals.delete(rec);
      else state.recipientTotals.set(rec, newTotal);
      state.grandTotal -= amount;
    }
    state.voterAllocations.delete(voter);
  }

  const newAllocs = new Map<string, bigint>();
  for (const vote of ballot.votes) {
    const amount = BigInt(vote.amount);
    if (amount <= 0n) continue;
    const rec = vote.recipient.account.toLowerCase();
    if (state.removedRecipients.has(rec)) continue;
    newAllocs.set(rec, amount);
    state.recipientTotals.set(
      rec,
      (state.recipientTotals.get(rec) ?? 0n) + amount,
    );
    state.grandTotal += amount;
  }
  if (newAllocs.size > 0) state.voterAllocations.set(voter, newAllocs);
}

function applyFlow(
  state: IncrementalState,
  sender: string,
  flowRate: bigint,
): void {
  if (flowRate > 0n) state.activeSenders.set(sender, flowRate);
  else state.activeSenders.delete(sender);
  state.totalPoolFlowRate = 0n;
  for (const rate of state.activeSenders.values()) {
    state.totalPoolFlowRate += rate;
  }
}

function advanceRemovals(
  state: IncrementalState,
  sortedRemovals: Array<{ recipient: string; timestamp: number }>,
  cursor: { idx: number },
  upTo: number,
): void {
  while (
    cursor.idx < sortedRemovals.length &&
    sortedRemovals[cursor.idx].timestamp <= upTo
  ) {
    const { recipient } = sortedRemovals[cursor.idx];
    cursor.idx++;
    if (state.removedRecipients.has(recipient)) continue;
    state.removedRecipients.add(recipient);
    for (const [voter, allocs] of state.voterAllocations) {
      const amount = allocs.get(recipient);
      if (amount == null || amount <= 0n) continue;
      allocs.delete(recipient);
      state.grandTotal -= amount;
      const newTotal = (state.recipientTotals.get(recipient) ?? 0n) - amount;
      if (newTotal <= 0n) state.recipientTotals.delete(recipient);
      else state.recipientTotals.set(recipient, newTotal);
      if (allocs.size === 0) state.voterAllocations.delete(voter);
    }
  }
}

export function buildTimeSeries(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
  granteeNames: string[],
  recipientRemovalMap: RecipientRemovalMap,
  nameMap: AddressNameMap,
): TimeSeries {
  const addressByName = new Map<string, string>();
  for (const [addr, name] of nameMap) addressByName.set(name, addr);

  const timeline = buildTimeline(ballots, flowEvents);
  const empty: TimeSeries = {
    fundingRateSeries: [],
    cumulativeSeries: [],
    fundersSeries: [],
    votersSeries: [],
    totalRateSeries: [],
    totalCumulativeSeries: [],
  };
  if (timeline.length === 0) return empty;

  const sortedRemovals = sortedRemovalList(recipientRemovalMap);
  const removalCursor = { idx: 0 };

  const state = newState();

  const cumulativeByGrantee = new Map<string, number>();
  for (const name of granteeNames) cumulativeByGrantee.set(name, 0);
  let totalCumulative = 0;

  const fundingRateSeries: TimeSeriesPoint[] = [];
  const cumulativeSeries: TimeSeriesPoint[] = [];
  const fundersSeries: TimeSeriesPoint[] = [];
  const votersSeries: TimeSeriesPoint[] = [];
  const totalRateSeries: TimeSeriesPoint[] = [];
  const totalCumulativeSeries: TimeSeriesPoint[] = [];

  let lastTime = timeline[0].timestamp;

  for (const evt of timeline) {
    const dt = evt.timestamp - lastTime;
    if (dt > 0) {
      const totalRate =
        weiPerSecToPerMonth(state.totalPoolFlowRate) * GRANTEE_POOL_SHARE;
      if (state.grandTotal > 0n && totalRate > 0) {
        const gt = Number(state.grandTotal);
        for (const name of granteeNames) {
          const addr = addressByName.get(name);
          if (!addr) continue;
          const rt = state.recipientTotals.get(addr);
          if (!rt) continue;
          const share = Number(rt) / gt;
          const accrued = (totalRate * share * dt) / SECONDS_IN_MONTH;
          cumulativeByGrantee.set(
            name,
            (cumulativeByGrantee.get(name) ?? 0) + accrued,
          );
        }
      }
      totalCumulative += (totalRate * dt) / SECONDS_IN_MONTH;
    }

    if (evt.type === "flow") {
      applyFlow(state, evt.sender, evt.flowRate);
    } else {
      applyBallot(state, evt.ballot);
    }
    advanceRemovals(state, sortedRemovals, removalCursor, evt.timestamp);
    lastTime = evt.timestamp;

    const totalRate =
      weiPerSecToPerMonth(state.totalPoolFlowRate) * GRANTEE_POOL_SHARE;
    const gt = state.grandTotal > 0n ? Number(state.grandTotal) : 0;

    const ratePoint: TimeSeriesPoint = { timestamp: evt.timestamp };
    const cumPoint: TimeSeriesPoint = { timestamp: evt.timestamp };
    for (const name of granteeNames) {
      const addr = addressByName.get(name);
      const rt = addr ? state.recipientTotals.get(addr) : undefined;
      const share = rt && gt > 0 ? Number(rt) / gt : 0;
      ratePoint[name] = totalRate * share;
      cumPoint[name] = cumulativeByGrantee.get(name) ?? 0;
    }
    fundingRateSeries.push(ratePoint);
    cumulativeSeries.push(cumPoint);

    fundersSeries.push({
      timestamp: evt.timestamp,
      funders: state.activeSenders.size,
    });
    votersSeries.push({
      timestamp: evt.timestamp,
      voters: state.allVoters.size,
    });
    totalRateSeries.push({ timestamp: evt.timestamp, totalRate });
    totalCumulativeSeries.push({
      timestamp: evt.timestamp,
      totalCumulative,
    });
  }

  return {
    fundingRateSeries,
    cumulativeSeries,
    fundersSeries,
    votersSeries,
    totalRateSeries,
    totalCumulativeSeries,
  };
}

export function buildProjectEpochData(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
  nameMap: AddressNameMap,
  recipientRemovalMap: RecipientRemovalMap,
): Map<string, ProjectEpochData[]> {
  const result = new Map<string, ProjectEpochData[]>();
  const granteeAddresses = [...nameMap.keys()];
  const now = Math.floor(Date.now() / 1000);
  const epochEnds = EPOCHS.map((e) => (e.end <= now ? e.end : now));

  const timeline = buildTimeline(ballots, flowEvents);
  const sortedRemovals = sortedRemovalList(recipientRemovalMap);
  const removalCursor = { idx: 0 };

  const state = newState();
  const cumulativeByAddress = new Map<string, number>();
  for (const addr of granteeAddresses) cumulativeByAddress.set(addr, 0);

  const cumulativeAtEnds: Map<string, number>[] = [];
  const allocsAtEnds: Map<string, Map<string, bigint>>[] = [];

  function accrueDt(dt: number): void {
    if (dt <= 0) return;
    const totalRate =
      weiPerSecToPerMonth(state.totalPoolFlowRate) * GRANTEE_POOL_SHARE;
    if (state.grandTotal <= 0n || totalRate === 0) return;
    const gt = Number(state.grandTotal);
    for (const addr of granteeAddresses) {
      const rt = state.recipientTotals.get(addr);
      if (!rt) continue;
      const share = Number(rt) / gt;
      const accrued = (totalRate * share * dt) / SECONDS_IN_MONTH;
      cumulativeByAddress.set(
        addr,
        (cumulativeByAddress.get(addr) ?? 0) + accrued,
      );
    }
  }

  function cloneAllocations(): Map<string, Map<string, bigint>> {
    const copy = new Map<string, Map<string, bigint>>();
    for (const [voter, allocs] of state.voterAllocations) {
      copy.set(voter, new Map(allocs));
    }
    return copy;
  }

  function snapshot(): void {
    cumulativeAtEnds.push(new Map(cumulativeByAddress));
    allocsAtEnds.push(cloneAllocations());
  }

  let lastTime = timeline.length > 0 ? timeline[0].timestamp : 0;
  let epochPtr = 0;

  for (const evt of timeline) {
    while (epochPtr < epochEnds.length && epochEnds[epochPtr] < evt.timestamp) {
      const epochEnd = epochEnds[epochPtr];
      const dt = epochEnd - lastTime;
      if (dt > 0) {
        accrueDt(dt);
        lastTime = epochEnd;
      }
      advanceRemovals(state, sortedRemovals, removalCursor, epochEnd);
      snapshot();
      epochPtr++;
    }

    const dt = evt.timestamp - lastTime;
    if (dt > 0) accrueDt(dt);

    if (evt.type === "flow") {
      applyFlow(state, evt.sender, evt.flowRate);
    } else {
      applyBallot(state, evt.ballot);
    }
    advanceRemovals(state, sortedRemovals, removalCursor, evt.timestamp);
    lastTime = evt.timestamp;

    while (
      epochPtr < epochEnds.length &&
      epochEnds[epochPtr] === evt.timestamp
    ) {
      snapshot();
      epochPtr++;
    }
  }

  while (epochPtr < epochEnds.length) {
    const epochEnd = epochEnds[epochPtr];
    const dt = epochEnd - lastTime;
    if (dt > 0) {
      accrueDt(dt);
      lastTime = epochEnd;
    }
    advanceRemovals(state, sortedRemovals, removalCursor, epochEnd);
    snapshot();
    epochPtr++;
  }

  for (const addr of granteeAddresses) {
    const name = nameMap.get(addr) ?? addr;
    const epochData: ProjectEpochData[] = [];

    for (let i = 0; i < EPOCHS.length; i++) {
      const allocations = allocsAtEnds[i];
      let totalVotes = 0n;
      let mentorVotes = 0n;
      let communityVotes = 0n;
      let metricsVotes = 0n;
      const uniqueVoters = new Set<string>();

      for (const [voter, voterAllocs] of allocations) {
        const amount = voterAllocs.get(addr);
        if (amount && amount > 0n) {
          totalVotes += amount;
          uniqueVoters.add(voter);
          const type = categorizeVoter(voter);
          if (type === "Mentor") mentorVotes += amount;
          else if (type === "Metrics") metricsVotes += amount;
          else communityVotes += amount;
        }
      }

      const totalForPct = Number(totalVotes) || 1;
      const cumulativeFunding = cumulativeAtEnds[i].get(addr) ?? 0;
      const prevCumulative =
        i > 0 ? (cumulativeAtEnds[i - 1].get(addr) ?? 0) : 0;
      const fundingAccrued = cumulativeFunding - prevCumulative;

      epochData.push({
        epoch: EPOCHS[i].number,
        votes: totalVotes,
        mentorPct:
          totalVotes > 0n ? (Number(mentorVotes) / totalForPct) * 100 : 0,
        communityPct:
          totalVotes > 0n ? (Number(communityVotes) / totalForPct) * 100 : 0,
        metricsPct:
          totalVotes > 0n ? (Number(metricsVotes) / totalForPct) * 100 : 0,
        uniqueVoters: uniqueVoters.size,
        fundingAccrued,
        cumulativeFunding,
      });
    }

    result.set(name, epochData);
  }

  return result;
}

export type MentorBallotVote = {
  projectName: string;
  amount: number;
};

export type MentorBallot = {
  timestamp: number;
  epoch: number;
  votes: MentorBallotVote[];
  votesUsed: number;
  votingPower: number;
};

export type MentorData = {
  address: string;
  name: string;
  currentVotingPower: number;
  currentVotesUsed: number;
  currentVotes: MentorBallotVote[];
  ballots: MentorBallot[];
};

function getEpochForTimestamp(ts: number): number {
  for (const epoch of EPOCHS) {
    if (ts >= epoch.start && ts <= epoch.end) return epoch.number;
  }
  return EPOCHS[EPOCHS.length - 1].number;
}

export function buildMentorBallotData(
  ballots: SubgraphBallot[],
  nameMap: AddressNameMap,
  mentorVoters: MentorVoterData[],
  activeGranteeNames: Set<string>,
): MentorData[] {
  const liveVotingPower = new Map<string, number>();
  for (const v of mentorVoters) {
    liveVotingPower.set(v.account.toLowerCase(), Number(v.votingPower));
  }

  const mentorBallots = new Map<string, SubgraphBallot[]>();
  for (const ballot of ballots) {
    if (ballot.votes.length === 0) continue;
    const addr = ballot.votes[0].votedBy.toLowerCase();
    if (!MENTOR_VOTERS.has(addr)) continue;
    let list = mentorBallots.get(addr);
    if (!list) {
      list = [];
      mentorBallots.set(addr, list);
    }
    list.push(ballot);
  }

  const mentors: MentorData[] = [];

  for (const addr of Object.keys(MENTOR_NAMES)) {
    const raw = mentorBallots.get(addr) ?? [];
    const sorted = [...raw].sort(
      (a, b) => Number(b.createdAtTimestamp) - Number(a.createdAtTimestamp),
    );

    const processedBallots: MentorBallot[] = sorted.map((ballot) => {
      const ts = Number(ballot.createdAtTimestamp);
      const epoch = getEpochForTimestamp(ts);
      const votes: MentorBallotVote[] = ballot.votes
        .filter((v) => BigInt(v.amount) > 0n)
        .map((v) => ({
          projectName:
            nameMap.get(v.recipient.account.toLowerCase()) ??
            v.recipient.account.toLowerCase(),
          amount: Number(v.amount),
        }))
        .sort((a, b) => b.amount - a.amount);

      const votesUsed = votes.reduce((sum, v) => sum + v.amount, 0);
      const votingPower =
        MENTOR_EPOCH_VOTING_POWER[epoch] ??
        liveVotingPower.get(addr) ??
        votesUsed;

      return { timestamp: ts, epoch, votes, votesUsed, votingPower };
    });

    const latestBallot = processedBallots[0];
    const activeEpoch = getEpochForTimestamp(Math.floor(Date.now() / 1000));
    const currentPower =
      MENTOR_EPOCH_VOTING_POWER[activeEpoch] ??
      liveVotingPower.get(addr) ??
      latestBallot?.votingPower ??
      0;

    const currentVotes = (latestBallot?.votes ?? []).filter((v) =>
      activeGranteeNames.has(v.projectName),
    );

    mentors.push({
      address: addr,
      name: MENTOR_NAMES[addr],
      currentVotingPower: currentPower,
      currentVotesUsed: currentVotes.reduce((sum, v) => sum + v.amount, 0),
      currentVotes,
      ballots: processedBallots,
    });
  }

  return mentors.sort((a, b) => a.name.localeCompare(b.name));
}

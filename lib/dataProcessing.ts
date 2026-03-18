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
  removedGranteeAddress: string | null,
): VotingEventRow[] {
  const rows: VotingEventRow[] = [];

  for (const ballot of ballots) {
    if (ballot.votes.length === 0) continue;
    const voterAddress = ballot.votes[0].votedBy.toLowerCase();
    const timestamp = Number(ballot.createdAtTimestamp);

    for (const vote of ballot.votes) {
      if (BigInt(vote.amount) === 0n) continue;
      const granteeAddress =
        vote.recipient?.account?.toLowerCase() ?? removedGranteeAddress;
      if (!granteeAddress) continue;
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
    const ballotTimestamps = [
      ...new Set(voterRows.map((r) => r.submissionTimestamp)),
    ].sort((a, b) => a - b);

    for (const row of voterRows) {
      const nextBallotIdx =
        ballotTimestamps.indexOf(row.submissionTimestamp) + 1;
      if (nextBallotIdx < ballotTimestamps.length) {
        row.replacedTimestamp = ballotTimestamps[nextBallotIdx];
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

type StateEvent = {
  timestamp: number;
  type: "ballot" | "flow";
  flowRate?: bigint;
  sender?: string;
};

function mergeEvents(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
): StateEvent[] {
  const events: StateEvent[] = [];
  for (const ballot of ballots) {
    events.push({
      timestamp: Number(ballot.createdAtTimestamp),
      type: "ballot",
    });
  }
  for (const fe of flowEvents) {
    events.push({
      timestamp: Number(fe.timestamp),
      type: "flow",
      flowRate: BigInt(fe.flowRate),
      sender: fe.sender.toLowerCase(),
    });
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}

function computeCumulativeFundingAtTime(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
  granteeAddresses: string[],
  upTo: number,
  removedGranteeAddress: string | null,
): Map<string, number> {
  const cumulativeByAddress = new Map<string, number>();
  for (const addr of granteeAddresses) {
    cumulativeByAddress.set(addr, 0);
  }

  const events = mergeEvents(ballots, flowEvents).filter(
    (e) => e.timestamp <= upTo,
  );
  if (events.length === 0) return cumulativeByAddress;

  let totalPoolFlowRate = 0n;
  const activeSenders = new Map<string, bigint>();
  let lastTimestamp = events[0].timestamp;

  for (const event of events) {
    const dt = event.timestamp - lastTimestamp;
    if (dt > 0) {
      const shares = computeVoteShares(
        reconstructAllocationsAtTime(ballots, lastTimestamp, removedGranteeAddress),
      );
      const totalRate = weiPerSecToPerMonth(totalPoolFlowRate) * GRANTEE_POOL_SHARE;
      for (const addr of granteeAddresses) {
        const share = shares.get(addr) ?? 0;
        const accrued = (totalRate * share * dt) / SECONDS_IN_MONTH;
        cumulativeByAddress.set(
          addr,
          (cumulativeByAddress.get(addr) ?? 0) + accrued,
        );
      }
    }

    if (event.type === "flow" && event.sender && event.flowRate !== undefined) {
      if (event.flowRate > 0n) activeSenders.set(event.sender, event.flowRate);
      else activeSenders.delete(event.sender);
      totalPoolFlowRate = 0n;
      for (const rate of activeSenders.values()) totalPoolFlowRate += rate;
    }

    lastTimestamp = event.timestamp;
  }

  // Accumulate from last event to upTo
  const dt = upTo - lastTimestamp;
  if (dt > 0) {
    const shares = computeVoteShares(
      reconstructAllocationsAtTime(ballots, lastTimestamp, removedGranteeAddress),
    );
    const totalRate = weiPerSecToPerMonth(totalPoolFlowRate) * GRANTEE_POOL_SHARE;
    for (const addr of granteeAddresses) {
      const share = shares.get(addr) ?? 0;
      const accrued = (totalRate * share * dt) / SECONDS_IN_MONTH;
      cumulativeByAddress.set(
        addr,
        (cumulativeByAddress.get(addr) ?? 0) + accrued,
      );
    }
  }

  return cumulativeByAddress;
}

function reconstructAllocationsAtTime(
  ballots: SubgraphBallot[],
  timestamp: number,
  removedGranteeAddress: string | null,
): Map<string, Map<string, bigint>> {
  const allocations = new Map<string, Map<string, bigint>>();

  const relevantBallots = ballots
    .filter((b) => Number(b.createdAtTimestamp) <= timestamp)
    .sort(
      (a, b) => Number(b.createdAtTimestamp) - Number(a.createdAtTimestamp),
    );

  const seen = new Set<string>();
  for (const ballot of relevantBallots) {
    if (ballot.votes.length === 0) continue;
    const voter = ballot.votes[0].votedBy.toLowerCase();
    if (seen.has(voter)) continue;
    seen.add(voter);

    const voterAllocs = new Map<string, bigint>();
    for (const vote of ballot.votes) {
      const amount = BigInt(vote.amount);
      if (amount > 0n) {
        const addr =
          vote.recipient?.account?.toLowerCase() ?? removedGranteeAddress;
        if (addr) voterAllocs.set(addr, amount);
      }
    }
    if (voterAllocs.size > 0) {
      allocations.set(voter, voterAllocs);
    }
  }

  return allocations;
}

function computeVoteShares(
  allocations: Map<string, Map<string, bigint>>,
): Map<string, number> {
  const recipientTotals = new Map<string, bigint>();
  let grandTotal = 0n;

  for (const voterAllocs of allocations.values()) {
    for (const [recipient, amount] of voterAllocs) {
      recipientTotals.set(
        recipient,
        (recipientTotals.get(recipient) ?? 0n) + amount,
      );
      grandTotal += amount;
    }
  }

  const shares = new Map<string, number>();
  if (grandTotal === 0n) return shares;

  for (const [recipient, total] of recipientTotals) {
    shares.set(recipient, Number(total) / Number(grandTotal));
  }
  return shares;
}

export function buildTimeSeries(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
  granteeNames: string[],
  removedGranteeAddress: string | null,
  nameMap: AddressNameMap,
): {
  fundingRateSeries: TimeSeriesPoint[];
  cumulativeSeries: TimeSeriesPoint[];
  fundersSeries: TimeSeriesPoint[];
  totalRateSeries: TimeSeriesPoint[];
  totalCumulativeSeries: TimeSeriesPoint[];
} {
  const nameByAddress = new Map<string, string>();
  for (const [addr, name] of nameMap) {
    nameByAddress.set(addr, name);
  }

  const events = mergeEvents(ballots, flowEvents);
  if (events.length === 0) {
    return {
      fundingRateSeries: [],
      cumulativeSeries: [],
      fundersSeries: [],
      totalRateSeries: [],
      totalCumulativeSeries: [],
    };
  }

  let totalPoolFlowRate = 0n;
  const activeSenders = new Map<string, bigint>();

  const fundingRateSeries: TimeSeriesPoint[] = [];
  const cumulativeSeries: TimeSeriesPoint[] = [];
  const fundersSeries: TimeSeriesPoint[] = [];
  const totalRateSeries: TimeSeriesPoint[] = [];
  const totalCumulativeSeries: TimeSeriesPoint[] = [];

  const cumulativeByGrantee = new Map<string, number>();
  for (const name of granteeNames) {
    cumulativeByGrantee.set(name, 0);
  }
  let totalCumulative = 0;
  let lastTimestamp = events[0].timestamp;

  for (const event of events) {
    const dt = event.timestamp - lastTimestamp;

    if (dt > 0) {
      const shares = computeVoteShares(
        reconstructAllocationsAtTime(ballots, lastTimestamp, removedGranteeAddress),
      );
      const totalRate = weiPerSecToPerMonth(totalPoolFlowRate) * GRANTEE_POOL_SHARE;

      for (const name of granteeNames) {
        const addr = [...nameByAddress.entries()].find(
          ([, n]) => n === name,
        )?.[0];
        const share = addr ? (shares.get(addr) ?? 0) : 0;
        const rateForGrantee = totalRate * share;
        const accrued = (rateForGrantee * dt) / SECONDS_IN_MONTH;
        cumulativeByGrantee.set(
          name,
          (cumulativeByGrantee.get(name) ?? 0) + accrued,
        );
      }
      totalCumulative +=
        (weiPerSecToPerMonth(totalPoolFlowRate) * GRANTEE_POOL_SHARE * dt) / SECONDS_IN_MONTH;
    }

    if (event.type === "flow" && event.sender && event.flowRate !== undefined) {
      if (event.flowRate > 0n) {
        activeSenders.set(event.sender, event.flowRate);
      } else {
        activeSenders.delete(event.sender);
      }
      totalPoolFlowRate = 0n;
      for (const rate of activeSenders.values()) {
        totalPoolFlowRate += rate;
      }
    }

    const shares = computeVoteShares(
      reconstructAllocationsAtTime(ballots, event.timestamp, removedGranteeAddress),
    );
    const totalRate = weiPerSecToPerMonth(totalPoolFlowRate) * GRANTEE_POOL_SHARE;

    const ratePoint: TimeSeriesPoint = { timestamp: event.timestamp };
    const cumPoint: TimeSeriesPoint = { timestamp: event.timestamp };
    for (const name of granteeNames) {
      const addr = [...nameByAddress.entries()].find(
        ([, n]) => n === name,
      )?.[0];
      const share = addr ? (shares.get(addr) ?? 0) : 0;
      ratePoint[name] = totalRate * share;
      cumPoint[name] = cumulativeByGrantee.get(name) ?? 0;
    }
    fundingRateSeries.push(ratePoint);
    cumulativeSeries.push(cumPoint);

    fundersSeries.push({
      timestamp: event.timestamp,
      funders: activeSenders.size,
    });

    totalRateSeries.push({
      timestamp: event.timestamp,
      totalRate,
    });

    totalCumulativeSeries.push({
      timestamp: event.timestamp,
      totalCumulative,
    });

    lastTimestamp = event.timestamp;
  }

  return {
    fundingRateSeries,
    cumulativeSeries,
    fundersSeries,
    totalRateSeries,
    totalCumulativeSeries,
  };
}

export function buildProjectEpochData(
  ballots: SubgraphBallot[],
  flowEvents: FlowUpdatedEvent[],
  nameMap: AddressNameMap,
  removedGranteeAddress: string | null,
): Map<string, ProjectEpochData[]> {
  const result = new Map<string, ProjectEpochData[]>();

  const granteeAddresses = [...nameMap.keys()];
  const addressToName = nameMap;
  const now = Math.floor(Date.now() / 1000);

  // Compute cumulative funding at each epoch boundary for all grantees
  const cumulativeAtEpochEnd: Map<string, number>[] = [];
  for (const epoch of EPOCHS) {
    const epochEnd = epoch.end <= now ? epoch.end : now;
    cumulativeAtEpochEnd.push(
      computeCumulativeFundingAtTime(
        ballots,
        flowEvents,
        granteeAddresses,
        epochEnd,
        removedGranteeAddress,
      ),
    );
  }

  for (const addr of granteeAddresses) {
    const name = addressToName.get(addr) ?? addr;
    const epochData: ProjectEpochData[] = [];

    for (let i = 0; i < EPOCHS.length; i++) {
      const epoch = EPOCHS[i];
      const allocations = reconstructAllocationsAtTime(ballots, epoch.end, removedGranteeAddress);

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

      const cumulativeFunding = cumulativeAtEpochEnd[i].get(addr) ?? 0;
      const prevCumulative =
        i > 0 ? (cumulativeAtEpochEnd[i - 1].get(addr) ?? 0) : 0;
      const fundingAccrued = cumulativeFunding - prevCumulative;

      epochData.push({
        epoch: epoch.number,
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
  removedGranteeAddress: string | null,
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
        .filter((v) => BigInt(v.amount) > 0n && (v.recipient?.account || removedGranteeAddress))
        .map((v) => {
          const granteeAddr =
            v.recipient?.account?.toLowerCase() ?? removedGranteeAddress!;
          return {
            projectName: nameMap.get(granteeAddr) ?? granteeAddr,
            amount: Number(v.amount),
          };
        })
        .sort((a, b) => b.amount - a.amount);

      const votesUsed = votes.reduce((sum, v) => sum + v.amount, 0);
      const votingPower =
        MENTOR_EPOCH_VOTING_POWER[epoch] ??
        liveVotingPower.get(addr) ??
        votesUsed;

      return { timestamp: ts, epoch, votes, votesUsed, votingPower };
    });

    const currentPower = liveVotingPower.get(addr) ?? 0;
    const latestBallot = processedBallots[0];

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

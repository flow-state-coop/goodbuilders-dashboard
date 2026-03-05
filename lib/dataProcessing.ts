import { categorizeVoter, EPOCHS, SECONDS_IN_MONTH } from "./constants";
import { weiPerSecToPerMonth } from "./utils";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  VotingEventRow,
  FundingPeriodRow,
  TimeSeriesPoint,
  ProjectEpochData,
  ApplicationData,
} from "@/types";

type AddressNameMap = Map<string, string>;

export function buildAddressNameMap(
  applications: ApplicationData[],
): AddressNameMap {
  const map = new Map<string, string>();
  for (const app of applications) {
    if (app.projectDetails?.name) {
      map.set(app.fundingAddress.toLowerCase(), app.projectDetails.name);
    }
  }
  return map;
}

export function processVotingEvents(
  ballots: SubgraphBallot[],
  nameMap: AddressNameMap,
): VotingEventRow[] {
  const rows: VotingEventRow[] = [];

  for (const ballot of ballots) {
    const voterAddress = ballot.voter.account.toLowerCase();
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

function reconstructAllocationsAtTime(
  ballots: SubgraphBallot[],
  timestamp: number,
): Map<string, Map<string, bigint>> {
  const allocations = new Map<string, Map<string, bigint>>();

  const relevantBallots = ballots
    .filter((b) => Number(b.createdAtTimestamp) <= timestamp)
    .sort(
      (a, b) => Number(b.createdAtTimestamp) - Number(a.createdAtTimestamp),
    );

  const seen = new Set<string>();
  for (const ballot of relevantBallots) {
    const voter = ballot.voter.account.toLowerCase();
    if (seen.has(voter)) continue;
    seen.add(voter);

    const voterAllocs = new Map<string, bigint>();
    for (const vote of ballot.votes) {
      const amount = BigInt(vote.amount);
      if (amount > 0n) {
        voterAllocs.set(vote.recipient.account.toLowerCase(), amount);
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

  type StateEvent = {
    timestamp: number;
    type: "ballot" | "flow";
    flowRate?: bigint;
    sender?: string;
  };

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
        reconstructAllocationsAtTime(ballots, lastTimestamp),
      );
      const totalRate = weiPerSecToPerMonth(totalPoolFlowRate);

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
        (weiPerSecToPerMonth(totalPoolFlowRate) * dt) / SECONDS_IN_MONTH;
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
      reconstructAllocationsAtTime(ballots, event.timestamp),
    );
    const totalRate = weiPerSecToPerMonth(totalPoolFlowRate);

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
): Map<string, ProjectEpochData[]> {
  const result = new Map<string, ProjectEpochData[]>();

  const granteeAddresses = [...nameMap.keys()];
  const addressToName = nameMap;

  for (const addr of granteeAddresses) {
    const name = addressToName.get(addr) ?? addr;
    const epochData: ProjectEpochData[] = [];

    for (const epoch of EPOCHS) {
      const allocations = reconstructAllocationsAtTime(ballots, epoch.end);

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

      const allShares = computeVoteShares(allocations);
      const share = allShares.get(addr) ?? 0;

      const activeSenders = new Map<string, bigint>();
      for (const fe of flowEvents) {
        if (Number(fe.timestamp) > epoch.end) break;
        const sender = fe.sender.toLowerCase();
        const rate = BigInt(fe.flowRate);
        if (rate > 0n) activeSenders.set(sender, rate);
        else activeSenders.delete(sender);
      }
      let poolRate = 0n;
      for (const r of activeSenders.values()) poolRate += r;

      const now = Math.floor(Date.now() / 1000);
      const epochStart = epoch.start || epoch.end - 14 * 24 * 60 * 60;
      const epochEnd = epoch.end <= now ? epoch.end : now;
      const epochDuration = epochEnd - epochStart;
      const fundingAccrued =
        weiPerSecToPerMonth(poolRate) *
        share *
        (epochDuration / SECONDS_IN_MONTH);

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
        cumulativeFunding: 0,
      });
    }

    let cumulative = 0;
    for (const ed of epochData) {
      cumulative += ed.fundingAccrued;
      ed.cumulativeFunding = cumulative;
    }

    result.set(name, epochData);
  }

  return result;
}

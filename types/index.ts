import { VoterType } from "@/lib/constants";

export type MentorVoterData = {
  account: string;
  votingPower: string;
};

export type SubgraphRecipient = {
  account: string;
  removed: boolean;
  removedAtTimestamp: string | null;
};

export type SubgraphBallot = {
  id: string;
  votes: { votedBy: string; recipient: { account: string }; amount: string }[];
  createdAtTimestamp: string;
};

export type FlowUpdatedEvent = {
  id: string;
  sender: string;
  receiver: string;
  flowRate: string;
  oldFlowRate: string;
  timestamp: string;
  totalAmountStreamedUntilTimestamp: string;
  type: number;
};

export type PoolMember = {
  account: { id: string };
  units: string;
  updatedAtTimestamp: string;
  totalAmountReceivedUntilUpdatedAt: string;
  isConnected: boolean;
};

export type PoolData = {
  flowRate: string;
  adjustmentFlowRate: string;
  totalAmountFlowedDistributedUntilUpdatedAt: string;
  updatedAtTimestamp: string;
  totalUnits: string;
  poolMembers: PoolMember[];
};

export type ApplicationData = {
  funding_address: string;
  project_name: string;
  status: string;
  project_id: number;
};

export type VotingEventRow = {
  voterAddress: string;
  voterType: VoterType;
  granteeName: string;
  granteeAddress: string;
  totalVotes: bigint;
  submissionTimestamp: number;
  replacedTimestamp: number | null;
};

export type FundingPeriodRow = {
  funderAddress: string;
  fundingRateWeiPerSec: bigint;
  fundingRatePerMonth: number;
  startTime: number;
  endTime: number | null;
  cumulativeFunding: bigint;
};

export type TimeSeriesPoint = {
  timestamp: number;
  [key: string]: number;
};

export type ProjectEpochData = {
  epoch: number;
  votes: bigint;
  mentorPct: number;
  communityPct: number;
  metricsPct: number;
  uniqueVoters: number;
  fundingAccrued: number;
  cumulativeFunding: number;
};

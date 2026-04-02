import { request } from "graphql-request";
import {
  FLOW_COUNCIL_SUBGRAPH,
  SUPERFLUID_SUBGRAPH,
  COUNCIL_ADDRESS,
  DISTRIBUTION_POOL,
  SUPER_APP,
  CHAIN_ID,
  MENTOR_NAMES,
} from "@/lib/constants";
import {
  ALL_BALLOTS_QUERY,
  FLOW_UPDATED_EVENTS_QUERY,
  DISTRIBUTION_POOL_QUERY,
  MENTOR_VOTERS_QUERY,
  RECIPIENTS_QUERY,
} from "@/lib/queries";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  PoolData,
  ApplicationData,
  MentorVoterData,
  SubgraphRecipient,
} from "@/types";
import DashboardClient from "@/components/DashboardClient";

async function fetchAllBallots(): Promise<SubgraphBallot[]> {
  const all: SubgraphBallot[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const data = await request<{ ballots: SubgraphBallot[] }>(
      FLOW_COUNCIL_SUBGRAPH,
      ALL_BALLOTS_QUERY,
      { councilId: COUNCIL_ADDRESS, first: pageSize, skip },
    );
    all.push(...data.ballots);
    if (data.ballots.length < pageSize) break;
    skip += pageSize;
  }

  return all;
}

async function fetchFlowEvents(): Promise<FlowUpdatedEvent[]> {
  const all: FlowUpdatedEvent[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const data = await request<{ flowUpdatedEvents: FlowUpdatedEvent[] }>(
      SUPERFLUID_SUBGRAPH,
      FLOW_UPDATED_EVENTS_QUERY,
      { receiver: SUPER_APP, first: pageSize, skip },
    );
    all.push(...data.flowUpdatedEvents);
    if (data.flowUpdatedEvents.length < pageSize) break;
    skip += pageSize;
  }

  return all;
}

async function fetchPool(): Promise<PoolData> {
  const data = await request<{ pool: PoolData }>(
    SUPERFLUID_SUBGRAPH,
    DISTRIBUTION_POOL_QUERY,
    { poolId: DISTRIBUTION_POOL },
  );
  return data.pool;
}

async function fetchMentorVoters(): Promise<MentorVoterData[]> {
  const accounts = Object.keys(MENTOR_NAMES);
  const data = await request<{ voters: MentorVoterData[] }>(
    FLOW_COUNCIL_SUBGRAPH,
    MENTOR_VOTERS_QUERY,
    { councilId: COUNCIL_ADDRESS, accounts },
  );
  return data.voters;
}

async function fetchRecipients(): Promise<SubgraphRecipient[]> {
  const data = await request<{ recipients: SubgraphRecipient[] }>(
    FLOW_COUNCIL_SUBGRAPH,
    RECIPIENTS_QUERY,
    { councilId: COUNCIL_ADDRESS },
  );
  return data.recipients;
}

async function fetchApplications(): Promise<ApplicationData[]> {
  const res = await fetch(
    `https://flowstate.network/api/flow-council/applications/public?chainId=${CHAIN_ID}&councilId=${COUNCIL_ADDRESS}`,
    { next: { revalidate: 300 } },
  );

  const json = await res.json();
  return json.success ? json.applications : [];
}

export const revalidate = 60;

export default async function Page() {
  const [ballots, flowEvents, pool, applications, mentorVoters, recipients] =
    await Promise.all([
      fetchAllBallots(),
      fetchFlowEvents(),
      fetchPool(),
      fetchApplications(),
      fetchMentorVoters(),
      fetchRecipients(),
    ]);

  return (
    <DashboardClient
      ballots={ballots}
      flowEvents={flowEvents}
      pool={pool}
      applications={applications}
      mentorVoters={mentorVoters}
      recipients={recipients}
    />
  );
}

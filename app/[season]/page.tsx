import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { request } from "graphql-request";
import { FLOW_COUNCIL_SUBGRAPH, SUPERFLUID_SUBGRAPH } from "@/lib/constants";
import { SEASONS, getSeason, SeasonConfig } from "@/lib/seasons";
import {
  ALL_BALLOTS_QUERY,
  FLOW_UPDATED_EVENTS_QUERY,
  DISTRIBUTION_POOL_QUERY,
  RECIPIENTS_QUERY,
} from "@/lib/queries";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  PoolData,
  ApplicationData,
  VoterGroup,
  SubgraphRecipient,
} from "@/types";
import DashboardClient from "@/components/DashboardClient";

const PLATFORM_API = "https://flowstate.network/api/flow-council";

async function fetchAllBallots(council: string): Promise<SubgraphBallot[]> {
  const all: SubgraphBallot[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const data = await request<{ ballots: SubgraphBallot[] }>(
      FLOW_COUNCIL_SUBGRAPH,
      ALL_BALLOTS_QUERY,
      { councilId: council, first: pageSize, skip },
    );
    all.push(...data.ballots);
    if (data.ballots.length < pageSize) break;
    skip += pageSize;
  }

  return all;
}

async function fetchFlowEvents(superApp: string): Promise<FlowUpdatedEvent[]> {
  const all: FlowUpdatedEvent[] = [];
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const data = await request<{ flowUpdatedEvents: FlowUpdatedEvent[] }>(
      SUPERFLUID_SUBGRAPH,
      FLOW_UPDATED_EVENTS_QUERY,
      { receiver: superApp, first: pageSize, skip },
    );
    all.push(...data.flowUpdatedEvents);
    if (data.flowUpdatedEvents.length < pageSize) break;
    skip += pageSize;
  }

  return all;
}

async function fetchPool(poolId: string): Promise<PoolData> {
  const data = await request<{ pool: PoolData }>(
    SUPERFLUID_SUBGRAPH,
    DISTRIBUTION_POOL_QUERY,
    { poolId },
  );
  return data.pool;
}

async function fetchRecipients(council: string): Promise<SubgraphRecipient[]> {
  const data = await request<{ recipients: SubgraphRecipient[] }>(
    FLOW_COUNCIL_SUBGRAPH,
    RECIPIENTS_QUERY,
    { councilId: council },
  );
  return data.recipients;
}

async function fetchApplications(
  season: SeasonConfig,
): Promise<ApplicationData[]> {
  const res = await fetch(
    `${PLATFORM_API}/applications/public?chainId=${season.chainId}&councilId=${season.council}`,
    { next: { revalidate: 300 } },
  );

  const json = await res.json();
  return json.success ? json.applications : [];
}

async function fetchVoterGroups(season: SeasonConfig): Promise<VoterGroup[]> {
  if (!season.fetchPlatformGroups) return season.staticGroups ?? [];

  const res = await fetch(
    `${PLATFORM_API}/voter-groups/public?chainId=${season.chainId}&councilId=${season.council}`,
    { next: { revalidate: 300 } },
  );

  const json = await res.json();
  return Array.isArray(json.groups) ? json.groups : [];
}

export const revalidate = 60;

export function generateStaticParams() {
  return SEASONS.map((s) => ({ season: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string }>;
}): Promise<Metadata> {
  const { season: seasonId } = await params;
  const season = getSeason(seasonId);
  if (!season) return {};
  return {
    title: `GoodBuilders ${season.label} - Flow Council Dashboard`,
    description: `Stats dashboard for the GoodBuilders ${season.label} Flow Council on Celo`,
  };
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const { season: seasonId } = await params;
  const season = getSeason(seasonId);
  if (!season) notFound();

  const [ballots, flowEvents, pool, applications, voterGroups] =
    await Promise.all([
      fetchAllBallots(season.council),
      fetchFlowEvents(season.superApp),
      fetchPool(season.distributionPool),
      fetchApplications(season),
      fetchVoterGroups(season),
    ]);

  const recipients = season.trackRemovals
    ? await fetchRecipients(season.council)
    : [];

  return (
    <DashboardClient
      season={season}
      seasons={SEASONS.map((s) => ({ id: s.id, label: s.label }))}
      ballots={ballots}
      flowEvents={flowEvents}
      pool={pool}
      applications={applications}
      voterGroups={voterGroups}
      recipients={recipients}
    />
  );
}

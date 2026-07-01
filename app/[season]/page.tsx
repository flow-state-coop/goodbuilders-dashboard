import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { request } from "graphql-request";
import { FLOW_COUNCIL_SUBGRAPH, SUPERFLUID_SUBGRAPH } from "@/lib/constants";
import { SEASONS, getSeason, SeasonConfig } from "@/lib/seasons";
import {
  ALL_BALLOTS_QUERY,
  FLOW_UPDATED_EVENTS_QUERY,
  DISTRIBUTION_POOL_QUERY,
  COUNCIL_VOTERS_QUERY,
  RECIPIENTS_QUERY,
} from "@/lib/queries";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  PoolData,
  ApplicationData,
  CouncilVoterData,
  VoterGroup,
  ProfileNameMap,
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

async function fetchCouncilVoters(
  council: string,
): Promise<CouncilVoterData[]> {
  const data = await request<{ voters: CouncilVoterData[] }>(
    FLOW_COUNCIL_SUBGRAPH,
    COUNCIL_VOTERS_QUERY,
    { councilId: council },
  );
  return data.voters;
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

async function fetchProfileNames(addresses: string[]): Promise<ProfileNameMap> {
  const normalized: ProfileNameMap = {};
  const batchSize = 500;

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const res = await fetch(`${PLATFORM_API}/voter-groups/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: batch }),
      next: { revalidate: 300 },
    });

    const json = await res.json();
    if (!json.success || !json.names) continue;

    for (const [addr, name] of Object.entries(json.names)) {
      normalized[addr.toLowerCase()] = name as string;
    }
  }

  return normalized;
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

  const [ballots, flowEvents, pool, applications, councilVoters, voterGroups] =
    await Promise.all([
      fetchAllBallots(season.council),
      fetchFlowEvents(season.superApp),
      fetchPool(season.distributionPool),
      fetchApplications(season),
      fetchCouncilVoters(season.council),
      fetchVoterGroups(season),
    ]);

  const recipients = season.trackRemovals
    ? await fetchRecipients(season.council)
    : [];

  let profileNames: ProfileNameMap = season.staticProfileNames ?? {};
  if (season.fetchProfiles) {
    const voterAddresses = new Set<string>();
    for (const v of councilVoters) voterAddresses.add(v.account.toLowerCase());
    for (const g of voterGroups) {
      for (const m of g.members) voterAddresses.add(m.toLowerCase());
    }
    for (const b of ballots) {
      if (b.votes.length > 0)
        voterAddresses.add(b.votes[0].votedBy.toLowerCase());
    }
    profileNames = await fetchProfileNames([...voterAddresses]);
  }

  return (
    <DashboardClient
      season={season}
      seasons={SEASONS.map((s) => ({ id: s.id, label: s.label }))}
      ballots={ballots}
      flowEvents={flowEvents}
      pool={pool}
      applications={applications}
      councilVoters={councilVoters}
      voterGroups={voterGroups}
      profileNames={profileNames}
      recipients={recipients}
    />
  );
}

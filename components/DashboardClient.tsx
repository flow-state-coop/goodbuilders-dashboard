"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Container, Form, Spinner, Stack, Tab, Tabs } from "react-bootstrap";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  PoolData,
  ApplicationData,
  VotingEventRow,
  ProjectEpochData,
  CouncilVoterData,
  VoterGroup,
  ProfileNameMap,
  SubgraphRecipient,
} from "@/types";
import { buildVoterGroupMap, buildGroupColorMap } from "@/lib/constants";
import { SeasonConfig } from "@/lib/seasons";
import {
  buildAddressNameMap,
  processVotingEvents,
  processStreamPeriods,
  buildTimeSeries,
  buildProjectEpochData,
  buildMentorBallotData,
  MentorData,
  RecipientRemovalMap,
  TimeSeries,
} from "@/lib/dataProcessing";
import { weiPerSecToPerMonth } from "@/lib/utils";
import VotingEventsTable from "./VotingEventsTable";
import VotingStats from "./VotingStats";
import FundingEventsTable from "./FundingEventsTable";
import HistoricalCharts from "./HistoricalCharts";
import ProjectTables from "./ProjectTables";
import MentorBreakdown from "./MentorBreakdown";
import GranteeFundingSummary from "./GranteeFundingSummary";

function TabLoading() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <Spinner animation="border" variant="secondary" />
    </div>
  );
}

export default function DashboardClient({
  season,
  seasons,
  ballots,
  flowEvents,
  pool,
  applications,
  councilVoters,
  voterGroups,
  profileNames,
  recipients,
}: {
  season: SeasonConfig;
  seasons: { id: string; label: string }[];
  ballots: SubgraphBallot[];
  flowEvents: FlowUpdatedEvent[];
  pool: PoolData;
  applications: ApplicationData[];
  councilVoters: CouncilVoterData[];
  voterGroups: VoterGroup[];
  profileNames: ProfileNameMap;
  recipients: SubgraphRecipient[];
}) {
  const router = useRouter();

  const nameMap = useMemo(
    () => buildAddressNameMap(applications),
    [applications],
  );

  const voterGroupMap = useMemo(
    () => buildVoterGroupMap(voterGroups),
    [voterGroups],
  );

  const voterGroupLabels = useMemo(
    () => voterGroups.map((g) => g.name),
    [voterGroups],
  );

  const groupColorMap = useMemo(
    () => buildGroupColorMap(voterGroupLabels),
    [voterGroupLabels],
  );

  const mentorAddresses = useMemo(() => {
    const group = voterGroups.find((g) => g.name === season.mentorGroupName);
    return (group?.members ?? []).map((m) => m.toLowerCase());
  }, [voterGroups, season.mentorGroupName]);

  const recipientRemovalMap: RecipientRemovalMap = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!season.trackRemovals) return map;
    for (const r of recipients) {
      map.set(
        r.account.toLowerCase(),
        r.removed && r.removedAtTimestamp ? Number(r.removedAtTimestamp) : null,
      );
    }
    return map;
  }, [recipients, season.trackRemovals]);

  const currentGranteeRates = useMemo(() => {
    const rates = new Map<string, number>();
    if (!pool) return rates;
    const poolFlowRate = BigInt(pool.flowRate);
    const totalUnits = BigInt(pool.totalUnits);
    if (totalUnits === 0n) return rates;
    const poolRatePerMonth = weiPerSecToPerMonth(poolFlowRate);
    for (const member of pool.poolMembers) {
      if (!member.account) continue;
      const units = BigInt(member.units);
      if (units === 0n) continue;
      const addr = member.account.id.toLowerCase();
      const name = nameMap.get(addr);
      if (name) {
        rates.set(
          name,
          (poolRatePerMonth * Number(units)) / Number(totalUnits),
        );
      }
    }
    return rates;
  }, [pool, nameMap]);

  const { activeGranteeNames, granteeStatuses } = useMemo(() => {
    const active = new Set<string>();
    const statuses = new Map<string, string>();
    for (const app of applications) {
      if (!app.project_name) continue;
      if (app.status === "ACCEPTED") active.add(app.project_name);
      else statuses.set(app.project_name, app.status);
    }
    return { activeGranteeNames: active, granteeStatuses: statuses };
  }, [applications]);

  const granteeNames = useMemo(() => {
    const namesWithVotes = new Set<string>();
    for (const ballot of ballots) {
      for (const vote of ballot.votes) {
        if (BigInt(vote.amount) > 0n) {
          const name = nameMap.get(vote.recipient.account.toLowerCase());
          if (name) namesWithVotes.add(name);
        }
      }
    }
    return [...namesWithVotes].sort();
  }, [ballots, nameMap]);

  const votingEvents = useMemo(
    () =>
      processVotingEvents(ballots, nameMap, voterGroupMap, recipientRemovalMap),
    [ballots, nameMap, voterGroupMap, recipientRemovalMap],
  );

  const fundingPeriods = useMemo(
    () => processStreamPeriods(flowEvents),
    [flowEvents],
  );

  const [timeSeries, setTimeSeries] = useState<TimeSeries | null>(null);
  const [projectEpochData, setProjectEpochData] = useState<Map<
    string,
    ProjectEpochData[]
  > | null>(null);
  const [mentorData, setMentorData] = useState<MentorData[] | null>(null);
  const [, startDerivedTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const compute = () => {
      if (cancelled) return;
      const ts = buildTimeSeries(
        ballots,
        flowEvents,
        granteeNames,
        nameMap,
        recipientRemovalMap,
      );
      const allEpochData = buildProjectEpochData(
        ballots,
        flowEvents,
        nameMap,
        voterGroupMap,
        season.epochs,
        recipientRemovalMap,
      );
      const granteeSet = new Set(granteeNames);
      const filteredEpochData = new Map<string, ProjectEpochData[]>();
      for (const [name, epochs] of allEpochData) {
        if (granteeSet.has(name)) filteredEpochData.set(name, epochs);
      }
      const mentors = buildMentorBallotData(
        ballots,
        nameMap,
        councilVoters,
        mentorAddresses,
        profileNames,
        season.epochs,
        {
          epochVotingPower: season.epochVotingPower,
          activeGranteeNames:
            season.mode === "legacy" ? activeGranteeNames : undefined,
        },
      );
      if (cancelled) return;
      startDerivedTransition(() => {
        setTimeSeries(ts);
        setProjectEpochData(filteredEpochData);
        setMentorData(mentors);
      });
    };
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(compute, { timeout: 500 });
    } else {
      timeoutHandle = setTimeout(compute, 0);
    }
    return () => {
      cancelled = true;
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [
    ballots,
    flowEvents,
    granteeNames,
    nameMap,
    voterGroupMap,
    recipientRemovalMap,
    councilVoters,
    mentorAddresses,
    profileNames,
    activeGranteeNames,
    season,
  ]);

  const [filteredVotingRows, setFilteredVotingRows] =
    useState<VotingEventRow[]>(votingEvents);

  const handleFilteredRowsChange = useCallback((rows: VotingEventRow[]) => {
    setFilteredVotingRows(rows);
  }, []);

  const deferredFilteredRows = useDeferredValue(filteredVotingRows);

  return (
    <Container fluid className="py-4 px-3 px-md-5">
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <img
          src="/logo.png"
          alt="Flow State"
          width={48}
          height={48}
          style={{ borderRadius: "0.5rem" }}
        />
        <div>
          <h1 className="mb-0" style={{ fontWeight: 700, color: "#056589" }}>
            GoodBuilders {season.label}
          </h1>
          <p className="mb-0" style={{ color: "#6c757d", fontWeight: 300 }}>
            Flow Council Stats Dashboard
          </p>
        </div>
        <Form.Select
          size="sm"
          value={season.id}
          onChange={(e) => router.push(`/${e.target.value}`)}
          className="ms-auto"
          style={{ maxWidth: 160 }}
          aria-label="Select season"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Form.Select>
      </div>

      <Tabs defaultActiveKey="voting" className="mb-4" mountOnEnter>
        <Tab eventKey="voting" title="Voting">
          <Stack gap={4}>
            <VotingStats
              rows={deferredFilteredRows}
              activeGranteeNames={activeGranteeNames}
              groupColorMap={groupColorMap}
            />
            <VotingEventsTable
              rows={votingEvents}
              granteeNames={granteeNames}
              voterGroupLabels={voterGroupLabels}
              groupColorMap={groupColorMap}
              profileNames={profileNames}
              onFilteredRowsChange={handleFilteredRowsChange}
            />
          </Stack>
        </Tab>

        <Tab eventKey="funding" title="Funding">
          {timeSeries ? (
            <Stack gap={4}>
              <GranteeFundingSummary
                cumulativeSeries={timeSeries.cumulativeSeries}
                granteeNames={granteeNames}
                fundingPeriods={fundingPeriods}
                currentGranteeRates={currentGranteeRates}
              />
              <FundingEventsTable rows={fundingPeriods} />
            </Stack>
          ) : (
            <TabLoading />
          )}
        </Tab>

        <Tab eventKey="mentors" title="Mentors">
          {mentorData ? (
            <MentorBreakdown mentors={mentorData} />
          ) : (
            <TabLoading />
          )}
        </Tab>

        <Tab eventKey="historical" title="Historical">
          {timeSeries ? (
            <HistoricalCharts
              fundingRateSeries={timeSeries.fundingRateSeries}
              cumulativeSeries={timeSeries.cumulativeSeries}
              fundersSeries={timeSeries.fundersSeries}
              votersSeries={timeSeries.votersSeries}
              totalRateSeries={timeSeries.totalRateSeries}
              totalCumulativeSeries={timeSeries.totalCumulativeSeries}
              granteeNames={granteeNames}
            />
          ) : (
            <TabLoading />
          )}
        </Tab>

        <Tab eventKey="projects" title="Epochs">
          {projectEpochData ? (
            <ProjectTables
              data={projectEpochData}
              granteeStatuses={granteeStatuses}
              epochs={season.epochs}
              voterGroupLabels={voterGroupLabels}
              groupColorMap={groupColorMap}
            />
          ) : (
            <TabLoading />
          )}
        </Tab>
      </Tabs>
    </Container>
  );
}

"use client";

import { useMemo, useState, useCallback } from "react";
import { Container, Stack, Tab, Tabs } from "react-bootstrap";
import {
  SubgraphBallot,
  FlowUpdatedEvent,
  PoolData,
  ApplicationData,
  VotingEventRow,
  ProjectEpochData,
  MentorVoterData,
} from "@/types";
import {
  buildAddressNameMap,
  processVotingEvents,
  processStreamPeriods,
  buildTimeSeries,
  buildProjectEpochData,
  buildMentorBallotData,
} from "@/lib/dataProcessing";
import VotingEventsTable from "./VotingEventsTable";
import VotingStats from "./VotingStats";
import FundingEventsTable from "./FundingEventsTable";
import HistoricalCharts from "./HistoricalCharts";
import ProjectTables from "./ProjectTables";
import MentorBreakdown from "./MentorBreakdown";
import GranteeFundingSummary from "./GranteeFundingSummary";

export default function DashboardClient({
  ballots,
  flowEvents,
  pool: _pool,
  applications,
  mentorVoters,
}: {
  ballots: SubgraphBallot[];
  flowEvents: FlowUpdatedEvent[];
  pool: PoolData;
  applications: ApplicationData[];
  mentorVoters: MentorVoterData[];
}) {
  const nameMap = useMemo(
    () => buildAddressNameMap(applications),
    [applications],
  );

  const { activeGranteeNames, removedGranteeAddresses, granteeStatuses } =
    useMemo(() => {
      const active = new Set<string>();
      const removed = new Map<string, string>();
      const statuses = new Map<string, string>();
      for (const app of applications) {
        const addr = app.funding_address.toLowerCase();
        if (app.status === "REMOVED" || app.status === "GRADUATED") {
          removed.set(addr, app.project_name);
          if (app.project_name) statuses.set(app.project_name, app.status);
        } else if (app.project_name) {
          active.add(app.project_name);
        }
      }
      return {
        activeGranteeNames: active,
        removedGranteeAddresses: removed,
        granteeStatuses: statuses,
      };
    }, [applications]);

  // When there's exactly one removed grantee, null recipients can be mapped to them.
  // With multiple removed grantees, null recipients are ambiguous and must be skipped.
  const removedGranteeAddress = removedGranteeAddresses.size === 1
    ? [...removedGranteeAddresses.keys()][0]
    : null;

  const granteeNames = useMemo(() => {
    const namesWithVotes = new Set<string>();
    for (const ballot of ballots) {
      for (const vote of ballot.votes) {
        if (BigInt(vote.amount) > 0n) {
          const addr = vote.recipient?.account?.toLowerCase() ?? removedGranteeAddress;
          if (!addr) continue;
          const name = nameMap.get(addr);
          if (name) namesWithVotes.add(name);
        }
      }
    }
    return [...namesWithVotes].sort();
  }, [ballots, nameMap, removedGranteeAddress]);

  const votingEvents = useMemo(
    () => processVotingEvents(ballots, nameMap, removedGranteeAddress),
    [ballots, nameMap, removedGranteeAddress],
  );

  const fundingPeriods = useMemo(
    () => processStreamPeriods(flowEvents),
    [flowEvents],
  );

  const timeSeries = useMemo(
    () => buildTimeSeries(ballots, flowEvents, granteeNames, removedGranteeAddress, nameMap),
    [ballots, flowEvents, granteeNames, removedGranteeAddress, nameMap],
  );

  const projectEpochData = useMemo(() => {
    const allData = buildProjectEpochData(ballots, flowEvents, nameMap, removedGranteeAddress);
    const granteeSet = new Set(granteeNames);
    const filtered = new Map<string, ProjectEpochData[]>();
    for (const [name, epochs] of allData) {
      if (granteeSet.has(name)) filtered.set(name, epochs);
    }
    return filtered;
  }, [ballots, flowEvents, nameMap, removedGranteeAddress, granteeNames]);

  const mentorData = useMemo(
    () =>
      buildMentorBallotData(
        ballots,
        nameMap,
        mentorVoters,
        activeGranteeNames,
        removedGranteeAddress,
      ),
    [ballots, nameMap, mentorVoters, activeGranteeNames, removedGranteeAddress],
  );

  const [filteredVotingRows, setFilteredVotingRows] =
    useState<VotingEventRow[]>(votingEvents);

  const handleFilteredRowsChange = useCallback((rows: VotingEventRow[]) => {
    setFilteredVotingRows(rows);
  }, []);

  return (
    <Container fluid className="py-4 px-3 px-md-5">
      <div className="d-flex align-items-center gap-3 mb-4">
        <img
          src="/logo.png"
          alt="Flow State"
          width={48}
          height={48}
          style={{ borderRadius: "0.5rem" }}
        />
        <div>
          <h1 className="mb-0" style={{ fontWeight: 700, color: "#056589" }}>
            GoodBuilders Season 3
          </h1>
          <p className="mb-0" style={{ color: "#6c757d", fontWeight: 300 }}>
            Flow Council Stats Dashboard
          </p>
        </div>
      </div>

      <Tabs defaultActiveKey="voting" className="mb-4">
        <Tab eventKey="voting" title="Voting">
          <Stack gap={4}>
            <VotingStats
              rows={filteredVotingRows}
              activeGranteeNames={activeGranteeNames}
            />
            <VotingEventsTable
              rows={votingEvents}
              granteeNames={granteeNames}
              activeGranteeNames={activeGranteeNames}
              onFilteredRowsChange={handleFilteredRowsChange}
            />
          </Stack>
        </Tab>

        <Tab eventKey="funding" title="Funding">
          <Stack gap={4}>
            <GranteeFundingSummary
              fundingRateSeries={timeSeries.fundingRateSeries}
              cumulativeSeries={timeSeries.cumulativeSeries}
              granteeNames={granteeNames}
              fundingPeriods={fundingPeriods}
              activeGranteeNames={activeGranteeNames}
            />
            <FundingEventsTable rows={fundingPeriods} />
          </Stack>
        </Tab>

        <Tab eventKey="mentors" title="Mentors">
          <MentorBreakdown mentors={mentorData} />
        </Tab>

        <Tab eventKey="historical" title="Historical">
          <HistoricalCharts
            fundingRateSeries={timeSeries.fundingRateSeries}
            cumulativeSeries={timeSeries.cumulativeSeries}
            fundersSeries={timeSeries.fundersSeries}
            totalRateSeries={timeSeries.totalRateSeries}
            totalCumulativeSeries={timeSeries.totalCumulativeSeries}
            granteeNames={granteeNames}
          />
        </Tab>

        <Tab eventKey="projects" title="Epochs">
          <ProjectTables data={projectEpochData} granteeStatuses={granteeStatuses} />
        </Tab>
      </Tabs>
    </Container>
  );
}

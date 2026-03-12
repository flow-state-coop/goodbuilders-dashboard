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

  const granteeNames = useMemo(() => {
    const namesWithVotes = new Set<string>();
    for (const ballot of ballots) {
      for (const vote of ballot.votes) {
        if (BigInt(vote.amount) > 0n) {
          const addr = vote.recipient.account.toLowerCase();
          const name = nameMap.get(addr);
          if (name) namesWithVotes.add(name);
        }
      }
    }
    return [...namesWithVotes].sort();
  }, [ballots, nameMap]);

  const votingEvents = useMemo(
    () => processVotingEvents(ballots, nameMap),
    [ballots, nameMap],
  );

  const fundingPeriods = useMemo(
    () => processStreamPeriods(flowEvents),
    [flowEvents],
  );

  const timeSeries = useMemo(
    () => buildTimeSeries(ballots, flowEvents, granteeNames, nameMap),
    [ballots, flowEvents, granteeNames, nameMap],
  );

  const projectEpochData = useMemo(() => {
    const allData = buildProjectEpochData(ballots, flowEvents, nameMap);
    const granteeSet = new Set(granteeNames);
    const filtered = new Map<string, ProjectEpochData[]>();
    for (const [name, epochs] of allData) {
      if (granteeSet.has(name)) filtered.set(name, epochs);
    }
    return filtered;
  }, [ballots, flowEvents, nameMap, granteeNames]);

  const mentorData = useMemo(
    () => buildMentorBallotData(ballots, nameMap, mentorVoters),
    [ballots, nameMap, mentorVoters],
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
            <VotingStats rows={filteredVotingRows} />
            <VotingEventsTable
              rows={votingEvents}
              granteeNames={granteeNames}
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
          <ProjectTables data={projectEpochData} />
        </Tab>
      </Tabs>
    </Container>
  );
}

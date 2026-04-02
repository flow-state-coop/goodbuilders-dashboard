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
  SubgraphRecipient,
} from "@/types";
import {
  buildAddressNameMap,
  processVotingEvents,
  processStreamPeriods,
  buildTimeSeries,
  buildProjectEpochData,
  buildMentorBallotData,
  RecipientRemovalMap,
} from "@/lib/dataProcessing";
import { weiPerSecToPerMonth } from "@/lib/utils";
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
  pool,
  applications,
  mentorVoters,
  recipients,
}: {
  ballots: SubgraphBallot[];
  flowEvents: FlowUpdatedEvent[];
  pool: PoolData;
  applications: ApplicationData[];
  mentorVoters: MentorVoterData[];
  recipients: SubgraphRecipient[];
}) {
  const nameMap = useMemo(
    () => buildAddressNameMap(applications),
    [applications],
  );

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

  const recipientRemovalMap: RecipientRemovalMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const r of recipients) {
      map.set(
        r.account.toLowerCase(),
        r.removed && r.removedAtTimestamp ? Number(r.removedAtTimestamp) : null,
      );
    }
    return map;
  }, [recipients]);

  const { activeGranteeNames, granteeStatuses } = useMemo(() => {
    const active = new Set<string>();
    const statuses = new Map<string, string>();
    for (const app of applications) {
      const addr = app.funding_address.toLowerCase();
      const removalTs = recipientRemovalMap.get(addr);
      if (removalTs != null) {
        if (app.project_name) statuses.set(app.project_name, app.status);
      } else if (app.project_name) {
        active.add(app.project_name);
      }
    }
    return { activeGranteeNames: active, granteeStatuses: statuses };
  }, [applications, recipientRemovalMap]);

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
    () => processVotingEvents(ballots, nameMap, recipientRemovalMap),
    [ballots, nameMap, recipientRemovalMap],
  );

  const fundingPeriods = useMemo(
    () => processStreamPeriods(flowEvents),
    [flowEvents],
  );

  const timeSeries = useMemo(
    () =>
      buildTimeSeries(
        ballots,
        flowEvents,
        granteeNames,
        recipientRemovalMap,
        nameMap,
      ),
    [ballots, flowEvents, granteeNames, recipientRemovalMap, nameMap],
  );

  const projectEpochData = useMemo(() => {
    const allData = buildProjectEpochData(
      ballots,
      flowEvents,
      nameMap,
      recipientRemovalMap,
    );
    const granteeSet = new Set(granteeNames);
    const filtered = new Map<string, ProjectEpochData[]>();
    for (const [name, epochs] of allData) {
      if (granteeSet.has(name)) filtered.set(name, epochs);
    }
    return filtered;
  }, [ballots, flowEvents, nameMap, recipientRemovalMap, granteeNames]);

  const mentorData = useMemo(
    () =>
      buildMentorBallotData(ballots, nameMap, mentorVoters, activeGranteeNames),
    [ballots, nameMap, mentorVoters, activeGranteeNames],
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
              onFilteredRowsChange={handleFilteredRowsChange}
            />
          </Stack>
        </Tab>

        <Tab eventKey="funding" title="Funding">
          <Stack gap={4}>
            <GranteeFundingSummary
              cumulativeSeries={timeSeries.cumulativeSeries}
              granteeNames={granteeNames}
              fundingPeriods={fundingPeriods}
              currentGranteeRates={currentGranteeRates}
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
            votersSeries={timeSeries.votersSeries}
            totalRateSeries={timeSeries.totalRateSeries}
            totalCumulativeSeries={timeSeries.totalCumulativeSeries}
            granteeNames={granteeNames}
          />
        </Tab>

        <Tab eventKey="projects" title="Epochs">
          <ProjectTables
            data={projectEpochData}
            granteeStatuses={granteeStatuses}
          />
        </Tab>
      </Tabs>
    </Container>
  );
}

"use client";

import { Accordion, Table } from "react-bootstrap";
import { ProjectEpochData } from "@/types";
import { EPOCHS } from "@/lib/constants";
import { formatGDollar } from "@/lib/utils";

export default function ProjectTables({
  data,
}: {
  data: Map<string, ProjectEpochData[]>;
}) {
  const now = Math.floor(Date.now() / 1000);
  const activeEpochs = EPOCHS.filter((e) => e.start <= now);
  const activeEpochNumbers = new Set(activeEpochs.map((e) => e.number));
  const entries = [...data.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <Accordion>
      {entries.map(([name, epochs], i) => (
        <Accordion.Item key={name} eventKey={String(i)}>
          <Accordion.Header>{name}</Accordion.Header>
          <Accordion.Body>
            <div className="table-responsive">
              <Table bordered size="sm">
                <thead>
                  <tr>
                    <th></th>
                    {activeEpochs.map((e) => (
                      <th key={e.number} className="text-center">
                        Epoch {e.number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-bold">Votes</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {ed.votes.toString()}
                        </td>
                      ))}
                  </tr>
                  <tr>
                    <td className="fw-bold">% Mentors</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {ed.mentorPct.toFixed(1)}%
                        </td>
                      ))}
                  </tr>
                  <tr>
                    <td className="fw-bold">% Community</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {ed.communityPct.toFixed(1)}%
                        </td>
                      ))}
                  </tr>
                  <tr>
                    <td className="fw-bold">% Metrics</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {ed.metricsPct.toFixed(1)}%
                        </td>
                      ))}
                  </tr>
                  <tr>
                    <td className="fw-bold">Unique Voters</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {ed.uniqueVoters}
                        </td>
                      ))}
                  </tr>
                  <tr>
                    <td className="fw-bold">Epoch Funding (G$)</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {formatGDollar(ed.fundingAccrued)}
                        </td>
                      ))}
                  </tr>
                  <tr>
                    <td className="fw-bold">Cumulative Funding (G$)</td>
                    {epochs
                      .filter((ed) => activeEpochNumbers.has(ed.epoch))
                      .map((ed) => (
                        <td key={ed.epoch} className="text-center">
                          {formatGDollar(ed.cumulativeFunding)}
                        </td>
                      ))}
                  </tr>
                </tbody>
              </Table>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

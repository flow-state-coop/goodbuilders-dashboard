"use client";

import { Badge, Card, Col, Row, Table } from "react-bootstrap";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ProjectEpochData } from "@/types";
import { EPOCHS, SECONDS_IN_MONTH, VOTER_TYPE_COLORS } from "@/lib/constants";
import { formatGDollar } from "@/lib/utils";

const STATUS_BADGE_STYLES: Record<string, { label: string; bg: string }> = {
  REMOVED: { label: "Removed", bg: "#dc3545" },
  GRADUATED: { label: "Graduated", bg: "#6f42c1" },
};

function EpochCell({
  epochNum,
  active,
  children,
}: {
  epochNum: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <td key={epochNum} className="text-center">
      {active ? children : null}
    </td>
  );
}

export default function ProjectTables({
  data,
  granteeStatuses,
}: {
  data: Map<string, ProjectEpochData[]>;
  granteeStatuses: Map<string, string>;
}) {
  const now = Math.floor(Date.now() / 1000);
  const activeEpochNumbers = new Set(
    EPOCHS.filter((e) => e.start <= now).map((e) => e.number),
  );
  const currentEpoch = EPOCHS.find((e) => e.start <= now && e.end > now);

  const epochDurations = new Map<number, number>();
  for (const e of EPOCHS) {
    if (!activeEpochNumbers.has(e.number)) continue;
    const start = e.start || e.end - 14 * 24 * 60 * 60;
    const end = e.end <= now ? e.end : now;
    epochDurations.set(e.number, end - start);
  }

  const entries = [...data.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <Row xs={1} lg={2} className="g-4">
      {entries.map(([name, epochs]) => {
        const latestActive = [...epochs]
          .reverse()
          .find((ed) => activeEpochNumbers.has(ed.epoch) && ed.votes > 0n);
        const pieData = latestActive
          ? [
              { name: "Mentor", value: latestActive.mentorPct },
              { name: "Community", value: latestActive.communityPct },
              { name: "Metrics", value: latestActive.metricsPct },
            ].filter((d) => d.value > 0)
          : [];

        const epochMap = new Map(epochs.map((ed) => [ed.epoch, ed]));

        return (
          <Col key={name}>
            <Card className="h-100">
              <Card.Header className="fw-bold d-flex align-items-center gap-2">
                {name}
                {(() => {
                  const status = granteeStatuses.get(name);
                  const badge = status ? STATUS_BADGE_STYLES[status] : null;
                  return badge ? (
                    <Badge
                      bg=""
                      style={{ backgroundColor: badge.bg, fontSize: "0.7em", fontWeight: 500 }}
                    >
                      {badge.label}
                    </Badge>
                  ) : null;
                })()}
              </Card.Header>
              <Card.Body>
                <div
                  className="table-responsive"
                  style={{ fontSize: "0.82em" }}
                >
                  <Table bordered size="sm" className="mb-0">
                    <thead>
                      <tr>
                        <th></th>
                        {EPOCHS.map((e) => (
                          <th
                            key={e.number}
                            className="text-center"
                            style={
                              e.number === currentEpoch?.number
                                ? {
                                    backgroundColor: "rgba(5,101,137,0.08)",
                                    borderBottom: "2px solid #056589",
                                  }
                                : undefined
                            }
                          >
                            {e.number === currentEpoch?.number && (
                              <span
                                className="d-block"
                                style={{ fontSize: "0.7em", color: "#056589" }}
                              >
                                current
                              </span>
                            )}
                            E{e.number}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="fw-bold">Votes</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed?.votes.toString()}
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">% Mentors</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed?.mentorPct.toFixed(1)}%
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">% Community</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed?.communityPct.toFixed(1)}%
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">% Metrics</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed?.metricsPct.toFixed(1)}%
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Unique Voters</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed?.uniqueVoters}
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Avg Rate (G$/mo)</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          const duration = epochDurations.get(e.number) || 1;
                          const rate = ed
                            ? (ed.fundingAccrued / duration) * SECONDS_IN_MONTH
                            : 0;
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {formatGDollar(rate)}
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Epoch Funding (G$)</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed && formatGDollar(ed.fundingAccrued)}
                            </EpochCell>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Cumulative (G$)</td>
                        {EPOCHS.map((e) => {
                          const ed = epochMap.get(e.number);
                          const active =
                            !!ed && activeEpochNumbers.has(e.number);
                          return (
                            <EpochCell
                              key={e.number}
                              epochNum={e.number}
                              active={active}
                            >
                              {ed && formatGDollar(ed.cumulativeFunding)}
                            </EpochCell>
                          );
                        })}
                      </tr>
                    </tbody>
                  </Table>
                </div>
                {pieData.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={45}
                        label={({ name, value }) =>
                          `${name} ${value.toFixed(0)}%`
                        }
                        style={{ fontSize: "0.75em" }}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              VOTER_TYPE_COLORS[
                                entry.name as keyof typeof VOTER_TYPE_COLORS
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={
                          ((value: number) => `${value.toFixed(1)}%`) as never
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

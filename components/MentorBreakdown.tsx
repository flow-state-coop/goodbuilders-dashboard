"use client";

import { useMemo, useState } from "react";
import { Card, Col, Row, Stack, Table, Form } from "react-bootstrap";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MentorData, MentorBallotVote } from "@/lib/dataProcessing";
import { generateColor } from "@/lib/constants";
import { formatTimestamp } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel({ cx, cy, midAngle, outerRadius: or, name, percent }: any) {
  const RADIAN = Math.PI / 180;
  const radius = or + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: "0.72rem" }}
    >
      {name} {((percent ?? 0) * 100).toFixed(0)}%
    </text>
  );
}

function MentorSummary({ mentors }: { mentors: MentorData[] }) {
  const summary = useMemo(() => {
    let totalUsed = 0;
    let totalAvailable = 0;
    const projectVotes = new Map<string, number>();

    for (const m of mentors) {
      totalUsed += m.currentVotesUsed;
      totalAvailable += m.currentVotingPower;
      for (const v of m.currentVotes) {
        projectVotes.set(
          v.projectName,
          (projectVotes.get(v.projectName) ?? 0) + v.amount,
        );
      }
    }

    const pieData = [...projectVotes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i, arr) => ({
        name,
        value,
        color: generateColor(i, arr.length),
      }));

    return { totalUsed, totalAvailable, pieData };
  }, [mentors]);

  const pct =
    summary.totalAvailable > 0
      ? ((summary.totalUsed / summary.totalAvailable) * 100).toFixed(1)
      : "0";

  const totalVotesAllProjects = summary.pieData.reduce(
    (s, d) => s + d.value,
    0,
  );

  return (
    <Stack gap={3} className="mb-4">
      <Stack
        direction="horizontal"
        gap={3}
        className="flex-wrap align-items-stretch"
      >
        <Card className="flex-fill" style={{ minWidth: 140 }}>
          <Card.Body className="text-center py-3">
            <div
              className="text-uppercase small mb-1"
              style={{
                color: "#6c757d",
                letterSpacing: "0.06em",
                fontWeight: 500,
              }}
            >
              Votes Used
            </div>
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#056589",
              }}
            >
              {summary.totalUsed.toLocaleString()}
            </div>
          </Card.Body>
        </Card>
        <Card className="flex-fill" style={{ minWidth: 140 }}>
          <Card.Body className="text-center py-3">
            <div
              className="text-uppercase small mb-1"
              style={{
                color: "#6c757d",
                letterSpacing: "0.06em",
                fontWeight: 500,
              }}
            >
              Votes Available
            </div>
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#056589",
              }}
            >
              {summary.totalAvailable.toLocaleString()}
            </div>
          </Card.Body>
        </Card>
        <Card className="flex-fill" style={{ minWidth: 140 }}>
          <Card.Body className="text-center py-3">
            <div
              className="text-uppercase small mb-1"
              style={{
                color: "#6c757d",
                letterSpacing: "0.06em",
                fontWeight: 500,
              }}
            >
              Utilization
            </div>
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#056589",
              }}
            >
              {pct}%
            </div>
          </Card.Body>
        </Card>
      </Stack>

      <Row xs={1} lg={2} className="g-3">
        <Col>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-center mb-2">
                Mentor Votes by Grantee
              </div>
              {summary.pieData.length > 0 ? (
                <div className="table-responsive" style={{ fontSize: "0.85em" }}>
                  <Table bordered size="sm" className="mb-0">
                    <thead>
                      <tr>
                        <th>Grantee</th>
                        <th className="text-end">Votes</th>
                        <th className="text-end">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.pieData.map((d) => (
                        <tr key={d.name}>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: d.color,
                                marginRight: 6,
                              }}
                            />
                            {d.name}
                          </td>
                          <td className="text-end">{d.value.toLocaleString()}</td>
                          <td className="text-end">
                            {totalVotesAllProjects > 0
                              ? (
                                  (d.value / totalVotesAllProjects) *
                                  100
                                ).toFixed(1)
                              : "0"}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div
                  className="d-flex align-items-center justify-content-center text-muted"
                  style={{ height: 180 }}
                >
                  No votes cast
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted small text-center mb-2">
                Vote Distribution
              </div>
              {summary.pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={summary.pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={{ strokeWidth: 1 }}
                      label={renderPieLabel}
                    >
                      {summary.pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="d-flex align-items-center justify-content-center text-muted"
                  style={{ height: 350 }}
                >
                  No votes cast
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Stack>
  );
}

function MentorCard({ mentor }: { mentor: MentorData }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (mentor.ballots.length === 0) {
    const power = mentor.currentVotingPower;
    return (
      <Card className="h-100">
        <Card.Header className="fw-bold">{mentor.name}</Card.Header>
        <Card.Body>
          <div
            className="text-center mb-3"
            style={{ fontSize: "1.1rem", fontWeight: 600 }}
          >
            <span style={{ color: "#056589" }}>0</span>
            {" / "}
            <span>{power}</span>
            {" votes used "}
            <span className="text-muted">(0%)</span>
          </div>
          <div className="text-center text-muted">No votes cast</div>
        </Card.Body>
      </Card>
    );
  }

  const ballot = mentor.ballots[selectedIdx];
  const votingPower =
    selectedIdx === 0 ? mentor.currentVotingPower : ballot.votingPower;
  const pct =
    votingPower > 0
      ? ((ballot.votesUsed / votingPower) * 100).toFixed(1)
      : "0";

  const pieData = ballot.votes.map((v, i) => ({
    name: v.projectName,
    value: v.amount,
    color: generateColor(i, ballot.votes.length),
  }));

  return (
    <Card className="h-100">
      <Card.Header className="fw-bold">{mentor.name}</Card.Header>
      <Card.Body>
        <Form.Select
          size="sm"
          className="mb-3"
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
        >
          {mentor.ballots.map((b, i) => (
            <option key={b.timestamp} value={i}>
              Epoch {b.epoch} &mdash; {formatTimestamp(b.timestamp)}
            </option>
          ))}
        </Form.Select>

        <div
          className="text-center mb-3"
          style={{ fontSize: "1.1rem", fontWeight: 600 }}
        >
          <span style={{ color: "#056589" }}>{ballot.votesUsed}</span>
          {" / "}
          <span>{votingPower}</span>
          {" votes used "}
          <span className="text-muted">({pct}%)</span>
        </div>

        <div className="table-responsive" style={{ fontSize: "0.82em" }}>
          <Table bordered size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Project</th>
                <th className="text-end">Votes</th>
                <th className="text-end">%</th>
              </tr>
            </thead>
            <tbody>
              {ballot.votes.map((v, i) => (
                <tr key={v.projectName}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: generateColor(
                          i,
                          ballot.votes.length,
                        ),
                        marginRight: 6,
                      }}
                    />
                    {v.projectName}
                  </td>
                  <td className="text-end">{v.amount}</td>
                  <td className="text-end">
                    {ballot.votesUsed > 0
                      ? ((v.amount / ballot.votesUsed) * 100).toFixed(1)
                      : "0"}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {pieData.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={60}
                labelLine={{ strokeWidth: 1 }}
                label={renderPieLabel}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card.Body>
    </Card>
  );
}

export default function MentorBreakdown({
  mentors,
}: {
  mentors: MentorData[];
}) {
  return (
    <>
      <MentorSummary mentors={mentors} />
      <Row xs={1} lg={2} className="g-4">
        {mentors.map((mentor) => (
          <Col key={mentor.address}>
            <MentorCard mentor={mentor} />
          </Col>
        ))}
      </Row>
    </>
  );
}

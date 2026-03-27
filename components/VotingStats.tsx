"use client";

import { useMemo } from "react";
import { Card, Stack } from "react-bootstrap";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { VotingEventRow } from "@/types";
import { VoterType, VOTER_TYPE_COLORS } from "@/lib/constants";

export default function VotingStats({
  rows,
  activeGranteeNames,
}: {
  rows: VotingEventRow[];
  activeGranteeNames: Set<string>;
}) {
  const stats = useMemo(() => {
    const voters = new Set<string>();
    const byType: Record<VoterType, bigint> = {
      Mentor: 0n,
      Metrics: 0n,
      Community: 0n,
    };
    let totalVotes = 0n;

    for (const row of rows) {
      if (row.replacedTimestamp !== null) continue;
      if (!activeGranteeNames.has(row.granteeName)) continue;
      voters.add(row.voterAddress);
      byType[row.voterType] += row.totalVotes;
      totalVotes += row.totalVotes;
    }

    const pieData = (Object.entries(byType) as [VoterType, bigint][])
      .filter(([, amount]) => amount > 0n)
      .map(([type, amount]) => ({
        name: type,
        value: Number(amount),
        color: VOTER_TYPE_COLORS[type],
      }));

    return {
      totalVotes: Number(totalVotes),
      uniqueVoters: voters.size,
      pieData,
    };
  }, [rows]);

  return (
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
            Total Votes
          </div>
          <div
            style={{ fontSize: "1.75rem", fontWeight: 700, color: "#056589" }}
          >
            {stats.totalVotes.toLocaleString()}
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
            Current Voters
          </div>
          <div
            style={{ fontSize: "1.75rem", fontWeight: 700, color: "#056589" }}
          >
            {stats.uniqueVoters.toLocaleString()}
          </div>
        </Card.Body>
      </Card>
      <Card className="flex-fill" style={{ minWidth: 300 }}>
        <Card.Body>
          <div className="text-muted small text-center mb-2">
            Votes by Voter Type
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={stats.pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={55}
                labelLine={{ strokeWidth: 1 }}
                label={({
                  cx: cxl,
                  cy: cyl,
                  midAngle,
                  outerRadius: or,
                  name,
                  percent,
                }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = (or as number) + 20;
                  const x =
                    (cxl as number) +
                    radius * Math.cos(-(midAngle as number) * RADIAN);
                  const y =
                    (cyl as number) +
                    radius * Math.sin(-(midAngle as number) * RADIAN);
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor={x > (cxl as number) ? "start" : "end"}
                      dominantBaseline="central"
                      style={{ fontSize: "0.72rem" }}
                    >
                      {name} {((percent ?? 0) * 100).toFixed(0)}%
                    </text>
                  );
                }}
              >
                {stats.pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </Stack>
  );
}

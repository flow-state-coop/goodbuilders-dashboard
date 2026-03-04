"use client";

import { useMemo } from "react";
import { Card, Stack } from "react-bootstrap";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { VotingEventRow } from "@/types";
import { VoterType, VOTER_TYPE_COLORS } from "@/lib/constants";

export default function VotingStats({ rows }: { rows: VotingEventRow[] }) {
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
        <Card.Body className="text-center">
          <div className="text-muted small">Total Votes</div>
          <div className="fs-3 fw-bold">{stats.totalVotes}</div>
        </Card.Body>
      </Card>
      <Card className="flex-fill" style={{ minWidth: 140 }}>
        <Card.Body className="text-center">
          <div className="text-muted small"># Voters</div>
          <div className="fs-3 fw-bold">{stats.uniqueVoters}</div>
        </Card.Body>
      </Card>
      <Card className="flex-fill" style={{ minWidth: 300 }}>
        <Card.Body>
          <div className="text-muted small text-center mb-2">
            Votes by Voter Type
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={stats.pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={65}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {stats.pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </Stack>
  );
}

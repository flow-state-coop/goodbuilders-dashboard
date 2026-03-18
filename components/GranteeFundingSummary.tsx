"use client";

import React, { useMemo, useState } from "react";
import { Card, Col, Row, Table } from "react-bootstrap";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Stack } from "react-bootstrap";
import { FundingPeriodRow, TimeSeriesPoint } from "@/types";
import { formatGDollar } from "@/lib/utils";
import { generateColor } from "@/lib/constants";

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

type PieEntry = { name: string; value: number; color: string };

const FundingPieChart = React.memo(function FundingPieChart({
  pieData,
}: {
  pieData: PieEntry[];
}) {
  return pieData.length > 0 ? (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          labelLine={{ strokeWidth: 1 }}
          label={renderPieLabel}
        >
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatGDollar(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  ) : (
    <div
      className="d-flex align-items-center justify-content-center text-muted"
      style={{ height: 350 }}
    >
      No funding data
    </div>
  );
});

type SortField = "name" | "rate" | "cumulative";
type SortDir = "asc" | "desc";

export default function GranteeFundingSummary({
  cumulativeSeries,
  granteeNames,
  fundingPeriods,
  currentGranteeRates,
}: {
  cumulativeSeries: TimeSeriesPoint[];
  granteeNames: string[];
  fundingPeriods: FundingPeriodRow[];
  currentGranteeRates: Map<string, number>;
}) {
  const [sortField, setSortField] = useState<SortField>("cumulative");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const latestCumulative =
    cumulativeSeries.length > 0
      ? cumulativeSeries[cumulativeSeries.length - 1]
      : null;

  const data = useMemo(
    () =>
      granteeNames.map((name) => ({
        name,
        rate: currentGranteeRates.get(name) ?? 0,
        cumulative: (latestCumulative?.[name] as number) ?? 0,
      })),
    [granteeNames, latestCumulative, currentGranteeRates],
  );

  const rows = useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let cmp: number;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else cmp = a[sortField] - b[sortField];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, sortField, sortDir]);

  const totalRate = data.reduce((s, d) => s + d.rate, 0);
  const totalCumulative = data.reduce((s, d) => s + d.cumulative, 0);
  const totalFunders = new Set(fundingPeriods.map((p) => p.funderAddress)).size;

  const pieData = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.cumulative - a.cumulative)
        .map((d, i, arr) => ({
          name: d.name,
          value: d.cumulative,
          color: generateColor(i, arr.length),
        })),
    [data],
  );

  const colorByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of pieData) m.set(d.name, d.color);
    return m;
  }, [pieData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const arrow = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const statCardStyle = {
    label: {
      color: "#6c757d",
      letterSpacing: "0.06em",
      fontWeight: 500,
    },
    value: {
      fontSize: "1.75rem",
      fontWeight: 700,
      color: "#056589",
    },
  };

  return (
    <Stack gap={3}>
      <Stack
        direction="horizontal"
        gap={3}
        className="flex-wrap align-items-stretch"
      >
        <Card className="flex-fill" style={{ minWidth: 140 }}>
          <Card.Body className="text-center py-3">
            <div className="text-uppercase small mb-1" style={statCardStyle.label}>
              Total Funding
            </div>
            <div style={statCardStyle.value}>
              {formatGDollar(totalCumulative)} G$
            </div>
          </Card.Body>
        </Card>
        <Card className="flex-fill" style={{ minWidth: 140 }}>
          <Card.Body className="text-center py-3">
            <div className="text-uppercase small mb-1" style={statCardStyle.label}>
              Current Rate
            </div>
            <div style={statCardStyle.value}>
              {formatGDollar(totalRate)} G$/mo
            </div>
          </Card.Body>
        </Card>
        <Card className="flex-fill" style={{ minWidth: 140 }}>
          <Card.Body className="text-center py-3">
            <div className="text-uppercase small mb-1" style={statCardStyle.label}>
              Total Funders
            </div>
            <div style={statCardStyle.value}>
              {totalFunders}
            </div>
          </Card.Body>
        </Card>
      </Stack>

    <Row xs={1} lg={2} className="g-3">
      <Col>
        <Card className="h-100">
          <Card.Body>
            <div className="text-muted small text-center mb-2">
              Funding by Grantee
            </div>
            <div className="table-responsive" style={{ fontSize: "0.85em" }}>
              <Table bordered size="sm" className="mb-0" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "25%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("name")}
                    >
                      Grantee{arrow("name")}
                    </th>
                    <th
                      className="text-end"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("rate")}
                    >
                      Current (G$/mo){arrow("rate")}
                    </th>
                    <th
                      className="text-end"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSort("cumulative")}
                    >
                      Cumulative (G$){arrow("cumulative")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: colorByName.get(row.name),
                            marginRight: 6,
                          }}
                        />
                        {row.name}
                      </td>
                      <td className="text-end">{formatGDollar(row.rate)}</td>
                      <td className="text-end">{formatGDollar(row.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fw-bold">
                    <td>Total</td>
                    <td className="text-end">{formatGDollar(totalRate)}</td>
                    <td className="text-end">{formatGDollar(totalCumulative)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Col>
      <Col>
        <Card className="h-100">
          <Card.Body>
            <div className="text-muted small text-center mb-2">
              Cumulative Funding Distribution
            </div>
            <FundingPieChart pieData={pieData} />
          </Card.Body>
        </Card>
      </Col>
    </Row>
    </Stack>
  );
}

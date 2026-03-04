"use client";

import { Card, Stack } from "react-bootstrap";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TimeSeriesPoint } from "@/types";
import { generateColor } from "@/lib/constants";
import { formatGDollar } from "@/lib/utils";

function formatTick(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const tooltipLabelFormatter = ((label: string | number) =>
  new Date(Number(label) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })) as never;

const tooltipValueFormatter = ((value: string | number) =>
  formatGDollar(Number(value))) as never;

export default function HistoricalCharts({
  fundingRateSeries,
  cumulativeSeries,
  fundersSeries,
  totalRateSeries,
  totalCumulativeSeries,
  granteeNames,
}: {
  fundingRateSeries: TimeSeriesPoint[];
  cumulativeSeries: TimeSeriesPoint[];
  fundersSeries: TimeSeriesPoint[];
  totalRateSeries: TimeSeriesPoint[];
  totalCumulativeSeries: TimeSeriesPoint[];
  granteeNames: string[];
}) {
  const colors = granteeNames.map((_, i) =>
    generateColor(i, granteeNames.length),
  );

  return (
    <Stack gap={4}>
      <Card>
        <Card.Body>
          <Card.Title className="fs-6">
            Funding Rate per Grantee (G$/mo)
          </Card.Title>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={fundingRateSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTick}
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
              />
              <YAxis tickFormatter={(v) => formatGDollar(v)} />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={tooltipValueFormatter}
              />
              <Legend />
              {granteeNames.map((name, i) => (
                <Line
                  key={name}
                  type="stepAfter"
                  dataKey={name}
                  stroke={colors[i]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="fs-6">
            Cumulative Funding per Grantee (G$)
          </Card.Title>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={cumulativeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTick}
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
              />
              <YAxis tickFormatter={(v) => formatGDollar(v)} />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={tooltipValueFormatter}
              />
              <Legend />
              {granteeNames.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={colors[i]}
                  fill={colors[i]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>

      <Stack direction="horizontal" gap={4} className="flex-wrap">
        <Card className="flex-fill" style={{ minWidth: 400 }}>
          <Card.Body>
            <Card.Title className="fs-6"># Funders Over Time</Card.Title>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={fundersSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTick}
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={tooltipLabelFormatter} />
                <Line
                  type="stepAfter"
                  dataKey="funders"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>

        <Card className="flex-fill" style={{ minWidth: 400 }}>
          <Card.Body>
            <Card.Title className="fs-6">Total Funding Rate (G$/mo)</Card.Title>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={totalRateSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTick}
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                />
                <YAxis tickFormatter={(v) => formatGDollar(v)} />
                <Tooltip
                  labelFormatter={tooltipLabelFormatter}
                  formatter={tooltipValueFormatter}
                />
                <Line
                  type="stepAfter"
                  dataKey="totalRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      </Stack>

      <Card>
        <Card.Body>
          <Card.Title className="fs-6">
            Total Cumulative Funding (G$)
          </Card.Title>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={totalCumulativeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTick}
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
              />
              <YAxis tickFormatter={(v) => formatGDollar(v)} />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                formatter={tooltipValueFormatter}
              />
              <Area
                type="monotone"
                dataKey="totalCumulative"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card.Body>
      </Card>
    </Stack>
  );
}

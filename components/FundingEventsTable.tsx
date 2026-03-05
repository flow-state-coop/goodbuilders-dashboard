"use client";

import { useMemo, useState } from "react";
import { Table, Form, Badge, Pagination, Stack } from "react-bootstrap";
import { FundingPeriodRow } from "@/types";
import {
  formatTimestamp,
  shortenAddress,
  formatGDollar,
  weiToGDollar,
} from "@/lib/utils";

type SortField =
  | "funderAddress"
  | "fundingRatePerMonth"
  | "startTime"
  | "endTime"
  | "cumulativeFunding";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

export default function FundingEventsTable({
  rows,
}: {
  rows: FundingPeriodRow[];
}) {
  const [sortField, setSortField] = useState<SortField>("startTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [addressFilter, setAddressFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "closed">(
    "",
  );
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = rows;

    if (addressFilter) {
      const lower = addressFilter.toLowerCase();
      result = result.filter((r) => r.funderAddress.includes(lower));
    }
    if (statusFilter === "active") {
      result = result.filter((r) => r.endTime === null);
    } else if (statusFilter === "closed") {
      result = result.filter((r) => r.endTime !== null);
    }

    return result;
  }, [rows, addressFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp: number;

      if (sortField === "cumulativeFunding") {
        cmp =
          a.cumulativeFunding < b.cumulativeFunding
            ? -1
            : a.cumulativeFunding > b.cumulativeFunding
              ? 1
              : 0;
      } else if (sortField === "endTime") {
        const ae = a.endTime ?? Infinity;
        const be = b.endTime ?? Infinity;
        cmp = ae - be;
      } else if (sortField === "fundingRatePerMonth") {
        cmp = a.fundingRatePerMonth - b.fundingRatePerMonth;
      } else if (sortField === "startTime") {
        cmp = a.startTime - b.startTime;
      } else {
        cmp = a.funderAddress.localeCompare(b.funderAddress);
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  return (
    <div>
      <Stack direction="horizontal" gap={3} className="mb-3 flex-wrap">
        <Form.Control
          size="sm"
          placeholder="Filter by address..."
          value={addressFilter}
          onChange={(e) => {
            setAddressFilter(e.target.value);
            setPage(1);
          }}
          style={{ maxWidth: 220 }}
        />
        <Form.Select
          size="sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "" | "active" | "closed");
            setPage(1);
          }}
          style={{ maxWidth: 160 }}
        >
          <option value="">All Streams</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </Form.Select>
      </Stack>

      <div className="table-responsive">
        <Table striped hover size="sm">
          <thead>
            <tr>
              <th role="button" onClick={() => handleSort("funderAddress")}>
                Funder Address{sortIndicator("funderAddress")}
              </th>
              <th
                role="button"
                onClick={() => handleSort("fundingRatePerMonth")}
              >
                Funding Rate (G$/mo){sortIndicator("fundingRatePerMonth")}
              </th>
              <th role="button" onClick={() => handleSort("startTime")}>
                Start Time{sortIndicator("startTime")}
              </th>
              <th role="button" onClick={() => handleSort("endTime")}>
                End Time{sortIndicator("endTime")}
              </th>
              <th role="button" onClick={() => handleSort("cumulativeFunding")}>
                Cumulative Funding (G$){sortIndicator("cumulativeFunding")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr key={`${row.funderAddress}-${row.startTime}-${i}`}>
                <td className="font-monospace" style={{ fontSize: "0.85em" }}>
                  <a
                    href={`https://celoscan.io/address/${row.funderAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {shortenAddress(row.funderAddress)}
                  </a>
                </td>
                <td>{formatGDollar(row.fundingRatePerMonth)}</td>
                <td>{formatTimestamp(row.startTime)}</td>
                <td>
                  {row.endTime === null ? (
                    <Badge style={{ backgroundColor: "#3c655b" }} bg="">
                      Active
                    </Badge>
                  ) : (
                    formatTimestamp(row.endTime)
                  )}
                </td>
                <td>{formatGDollar(weiToGDollar(row.cumulativeFunding))}</td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  No funding events match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <Stack
        direction="horizontal"
        className="justify-content-between align-items-center"
      >
        <small className="text-muted">
          {sorted.length} stream period{sorted.length !== 1 ? "s" : ""}
        </small>
        {totalPages > 1 && (
          <Pagination size="sm" className="mb-0">
            <Pagination.First
              onClick={() => setPage(1)}
              disabled={page === 1}
            />
            <Pagination.Prev
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            />
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <Pagination.Item
                  key={p}
                  active={p === page}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Pagination.Item>
              );
            })}
            <Pagination.Next
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            />
            <Pagination.Last
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            />
          </Pagination>
        )}
      </Stack>
    </div>
  );
}

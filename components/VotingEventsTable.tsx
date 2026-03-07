"use client";

import { useMemo, useState } from "react";
import { Table, Form, Badge, Pagination, Stack } from "react-bootstrap";
import { VotingEventRow } from "@/types";
import { VoterType, MENTOR_NAMES } from "@/lib/constants";
import { formatTimestamp, shortenAddress } from "@/lib/utils";

type SortField = keyof VotingEventRow;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

export default function VotingEventsTable({
  rows,
  granteeNames,
  onFilteredRowsChange,
}: {
  rows: VotingEventRow[];
  granteeNames: string[];
  onFilteredRowsChange: (rows: VotingEventRow[]) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("submissionTimestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [addressFilter, setAddressFilter] = useState("");
  const [voterTypeFilter, setVoterTypeFilter] = useState<VoterType | "">("");
  const [granteeFilter, setGranteeFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = rows;

    if (addressFilter) {
      const lower = addressFilter.toLowerCase();
      result = result.filter(
        (r) =>
          r.voterAddress.includes(lower) ||
          (MENTOR_NAMES[r.voterAddress]?.toLowerCase().includes(lower) ?? false),
      );
    }
    if (voterTypeFilter) {
      result = result.filter((r) => r.voterType === voterTypeFilter);
    }
    if (granteeFilter) {
      result = result.filter((r) => r.granteeName === granteeFilter);
    }

    onFilteredRowsChange(result);
    return result;
  }, [
    rows,
    addressFilter,
    voterTypeFilter,
    granteeFilter,
    onFilteredRowsChange,
  ]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp: number;
      const fa = a[sortField];
      const fb = b[sortField];

      if (typeof fa === "bigint" && typeof fb === "bigint") {
        cmp = fa < fb ? -1 : fa > fb ? 1 : 0;
      } else if (typeof fa === "number" && typeof fb === "number") {
        cmp = fa - fb;
      } else if (fa === null && fb === null) {
        cmp = 0;
      } else if (fa === null) {
        cmp = 1;
      } else if (fb === null) {
        cmp = -1;
      } else {
        cmp = String(fa).localeCompare(String(fb));
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
          placeholder="Filter by name or address..."
          value={addressFilter}
          onChange={(e) => {
            setAddressFilter(e.target.value);
            setPage(1);
          }}
          style={{ maxWidth: 220 }}
        />
        <Form.Select
          size="sm"
          value={voterTypeFilter}
          onChange={(e) => {
            setVoterTypeFilter(e.target.value as VoterType | "");
            setPage(1);
          }}
          style={{ maxWidth: 160 }}
        >
          <option value="">All Voter Types</option>
          <option value="Mentor">Mentor</option>
          <option value="Metrics">Metrics</option>
          <option value="Community">Community</option>
        </Form.Select>
        <Form.Select
          size="sm"
          value={granteeFilter}
          onChange={(e) => {
            setGranteeFilter(e.target.value);
            setPage(1);
          }}
          style={{ maxWidth: 200 }}
        >
          <option value="">All Grantees</option>
          {granteeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Form.Select>
      </Stack>

      <div className="table-responsive">
        <Table striped hover size="sm">
          <thead>
            <tr>
              <th role="button" onClick={() => handleSort("voterAddress")}>
                Voter{sortIndicator("voterAddress")}
              </th>
              <th role="button" onClick={() => handleSort("voterType")}>
                Voter Type{sortIndicator("voterType")}
              </th>
              <th role="button" onClick={() => handleSort("granteeName")}>
                Grantee Name{sortIndicator("granteeName")}
              </th>
              <th role="button" onClick={() => handleSort("totalVotes")}>
                # Votes{sortIndicator("totalVotes")}
              </th>
              <th
                role="button"
                onClick={() => handleSort("submissionTimestamp")}
              >
                Submitted{sortIndicator("submissionTimestamp")}
              </th>
              <th role="button" onClick={() => handleSort("replacedTimestamp")}>
                Replaced{sortIndicator("replacedTimestamp")}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr
                key={`${row.voterAddress}-${row.granteeAddress}-${row.submissionTimestamp}-${i}`}
              >
                <td style={{ fontSize: "0.85em" }}>
                  <a
                    href={`https://celoscan.io/address/${row.voterAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {MENTOR_NAMES[row.voterAddress] ?? shortenAddress(row.voterAddress)}
                  </a>
                </td>
                <td>
                  <Badge
                    style={{
                      backgroundColor:
                        row.voterType === "Mentor"
                          ? "#056589"
                          : row.voterType === "Metrics"
                            ? "#d4890a"
                            : "#3c655b",
                    }}
                    bg=""
                  >
                    {row.voterType}
                  </Badge>
                </td>
                <td>{row.granteeName}</td>
                <td>{row.totalVotes.toString()}</td>
                <td>{formatTimestamp(row.submissionTimestamp)}</td>
                <td>
                  {row.replacedTimestamp === null ? (
                    <Badge style={{ backgroundColor: "#056589" }} bg="">
                      Current
                    </Badge>
                  ) : (
                    formatTimestamp(row.replacedTimestamp)
                  )}
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  No voting events match the current filters.
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
          {sorted.length} result{sorted.length !== 1 ? "s" : ""}
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

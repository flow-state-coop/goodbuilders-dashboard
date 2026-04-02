import { SECONDS_IN_MONTH } from "./constants";

export function weiPerSecToPerMonth(weiPerSec: bigint): number {
  return Number(weiPerSec * BigInt(Math.round(SECONDS_IN_MONTH))) / 1e18;
}

export function formatGDollar(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function weiToGDollar(wei: bigint): number {
  return Number(wei) / 1e18;
}

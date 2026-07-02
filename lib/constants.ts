export const FLOW_COUNCIL_SUBGRAPH =
  "https://api.goldsky.com/api/public/project_cmbkdj2bd7cr601uwafoe4u3y/subgraphs/flow-council-celo/v0.4.2/gn";
export const SUPERFLUID_SUBGRAPH =
  "https://subgraph-endpoints.superfluid.dev/celo-mainnet/protocol-v1";

export const SECONDS_IN_MONTH = (365 / 12) * 24 * 60 * 60;
export const GRANTEE_POOL_SHARE = 0.95;

export const DEFAULT_VOTER_GROUP_LABEL = "Community";

export type VoterType = string;

export const KNOWN_GROUP_COLORS: Record<string, string> = {
  Mentors: "#056589",
  Community: "#3c655b",
  Metrics: "#d4890a",
};

export function generateColor(index: number, total: number): string {
  const hue = (index * 360) / total;
  return `hsl(${hue}, 70%, 55%)`;
}

export function buildGroupColorMap(labels: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  labels.forEach((label, i) => {
    map[label] = KNOWN_GROUP_COLORS[label] ?? generateColor(i, labels.length);
  });
  return map;
}

export function buildVoterGroupMap(
  groups: { name: string; members: string[] }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      map.set(member.toLowerCase(), group.name);
    }
  }
  return map;
}

export function categorizeVoter(
  address: string,
  groupMap: Map<string, string>,
  defaultLabel: string = DEFAULT_VOTER_GROUP_LABEL,
): VoterType {
  return groupMap.get(address.toLowerCase()) ?? defaultLabel;
}

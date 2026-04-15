export const COUNCIL_ADDRESS = "0xfabef1abae4998146e8a8422813eb787caa26ec2";
export const DISTRIBUTION_POOL = "0xd56e85acdd6481c912c2020dff35e4207824aac2";
export const SUPER_APP = "0x496e247cc0dc5e707cc2684ae04e8e337637f3fa";
export const SUPER_TOKEN = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a";
export const CHAIN_ID = 42220;

export const FLOW_COUNCIL_SUBGRAPH =
  "https://api.goldsky.com/api/public/project_cmbkdj2bd7cr601uwafoe4u3y/subgraphs/flow-council-celo/v0.4.1/gn";
export const SUPERFLUID_SUBGRAPH =
  "https://subgraph-endpoints.superfluid.dev/celo-mainnet/protocol-v1";

export const SECONDS_IN_MONTH = (365 / 12) * 24 * 60 * 60;
export const GRANTEE_POOL_SHARE = 0.95;

export const EPOCHS = [
  { number: 1, start: 0, end: 1772625600 },
  { number: 2, start: 1772625601, end: 1773835200 },
  { number: 3, start: 1773835201, end: 1775044800 },
  { number: 4, start: 1775044801, end: 1776254400 },
  { number: 5, start: 1776254401, end: 1777464000 },
  { number: 6, start: 1777464001, end: 1778673600 },
];

const METRICS_VOTERS = new Set(["0x7f0a04f131b8395e4e0bcf4c77e47845c952f49d"]);

export const MENTOR_NAMES: Record<string, string> = {
  "0x9f6c0ac954829a863e8d09a46a7a167d5763975c": "Solène Daviaud",
  "0x5a9f2ca69f82621c841efefabd1f244273cd0245": "Kaspar Kallas",
  "0x0994e0206e3fa5dea037a6bfbcf168b94bf74bc3": "Rael",
  "0xf62daae4c3f9fadf689f767716a82dfee5026c89": "Philipp Teles",
  "0x6e7679d53c43a8a9e2cf87fca99a1db9b379fe29": "Cotabe",
  "0x6eeb37b9757dca963120f61c7e0e0160469a44d3": "Meri Fernandez",
  "0x884ff907d5fb8bae239b64aa8ad18ba3f8196038": "Graven",
  "0x31cd90c2788f3e390d2bb72871f5ad3f1a4b22a1": "LuukDAO",
  "0xa48840d89a761502a4a7d995c74f3864d651a87f": "Hadar Rottenberg",
  "0x3b7275c428c9b46d2c244e066c0bbadb9b9a8b9f": "Laurence",
  "0xf3d4ef9c67bbdb40e7a16975a8a8a4d8e41df8d9": "Sam McCarthy",
  "0xa50064d462e17f7091ee62baebeb18bfebe21507": "Drew Simon",
};

export const MENTOR_EPOCH_VOTING_POWER: Record<number, number> = {
  1: 100,
  2: 2596,
  3: 3418,
  4: 6785,
  5: 7738,
};

export const MENTOR_VOTERS = new Set(Object.keys(MENTOR_NAMES));

export type VoterType = "Mentor" | "Metrics" | "Community";

export function categorizeVoter(address: string): VoterType {
  const addr = address.toLowerCase();
  if (METRICS_VOTERS.has(addr)) return "Metrics";
  if (MENTOR_VOTERS.has(addr)) return "Mentor";
  return "Community";
}

export const VOTER_TYPE_COLORS: Record<VoterType, string> = {
  Mentor: "#056589",
  Metrics: "#d4890a",
  Community: "#3c655b",
};

export function generateColor(index: number, total: number): string {
  const hue = (index * 360) / total;
  return `hsl(${hue}, 70%, 55%)`;
}

import { VoterGroup } from "@/types";

export type SeasonMode = "legacy" | "platform";

export type EpochConfig = { number: number; start: number; end: number };

export type SeasonConfig = {
  id: string;
  label: string;
  chainId: number;
  council: string;
  distributionPool: string;
  superApp: string;
  superToken: string;
  epochs: EpochConfig[];
  mode: SeasonMode;
  mentorGroupName: string;
  defaultGroupLabel: string;
  trackRemovals: boolean;
  fetchPlatformGroups: boolean;
  fetchProfiles: boolean;
  staticGroups?: VoterGroup[];
  staticProfileNames?: Record<string, string>;
  epochVotingPower?: Record<number, number>;
};

const S3_MENTOR_NAMES: Record<string, string> = {
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

const S3_METRICS_VOTER = "0x7f0a04f131b8395e4e0bcf4c77e47845c952f49d";

const S3_STATIC_GROUPS: VoterGroup[] = [
  {
    name: "Mentors",
    eligibilityMethod: "manual",
    members: Object.keys(S3_MENTOR_NAMES),
  },
  { name: "Community", eligibilityMethod: "gooddollar", members: [] },
  {
    name: "Metrics",
    eligibilityMethod: "metrics",
    members: [S3_METRICS_VOTER],
  },
];

const SEASON_3: SeasonConfig = {
  id: "s3",
  label: "Season 3",
  chainId: 42220,
  council: "0xfabef1abae4998146e8a8422813eb787caa26ec2",
  distributionPool: "0xd56e85acdd6481c912c2020dff35e4207824aac2",
  superApp: "0x496e247cc0dc5e707cc2684ae04e8e337637f3fa",
  superToken: "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a",
  epochs: [
    { number: 1, start: 0, end: 1772625600 },
    { number: 2, start: 1772625601, end: 1773835200 },
    { number: 3, start: 1773835201, end: 1775044800 },
    { number: 4, start: 1775044801, end: 1776254400 },
    { number: 5, start: 1776254401, end: 1777464000 },
    { number: 6, start: 1777464001, end: 1778673600 },
  ],
  mode: "legacy",
  mentorGroupName: "Mentors",
  defaultGroupLabel: "Community",
  trackRemovals: true,
  fetchPlatformGroups: false,
  fetchProfiles: false,
  staticGroups: S3_STATIC_GROUPS,
  staticProfileNames: S3_MENTOR_NAMES,
  epochVotingPower: { 1: 100, 2: 2596, 3: 3418, 4: 6785, 5: 7738, 6: 9294 },
};

const SEASON_4: SeasonConfig = {
  id: "s4",
  label: "Season 4",
  chainId: 42220,
  council: "0x582e3314d4ef56c18930acb10bb64313525e7820",
  distributionPool: "0xe6cedec2bc4cd5a13744516f533a46dcb3e6c416",
  superApp: "0xf4dfaabbc75bd9dbd31499236e5c06eba0d3dab8",
  superToken: "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a",
  epochs: [
    { number: 1, start: 1782864000, end: 1784073599 },
    { number: 2, start: 1784073600, end: 1785283199 },
    { number: 3, start: 1785283200, end: 1786492799 },
    { number: 4, start: 1786492800, end: 1787702399 },
    { number: 5, start: 1787702400, end: 1788911999 },
    { number: 6, start: 1788912000, end: 1790121599 },
  ],
  mode: "platform",
  mentorGroupName: "Mentors",
  defaultGroupLabel: "Community",
  trackRemovals: false,
  fetchPlatformGroups: true,
  fetchProfiles: true,
};

export const SEASONS: SeasonConfig[] = [SEASON_4, SEASON_3];

export const DEFAULT_SEASON_ID = "s4";

export function getSeason(id: string): SeasonConfig | undefined {
  return SEASONS.find((s) => s.id === id);
}

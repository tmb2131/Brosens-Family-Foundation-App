import {
  MandatePolicyContent,
  MandateSectionDiff,
  MandateSectionKey
} from "@/lib/types";

export const MANDATE_POLICY_SLUG = "mandate";
export const MANDATE_POLICY_TITLE = "Brosens Family Foundation Mandate";

export const MANDATE_SECTION_ORDER: MandateSectionKey[] = [
  "missionStatement",
  "structure",
  "jointGivingPolicy",
  "discretionaryGivingPolicy",
  "process",
  "annualCycle",
  "rolesAndResponsibilities",
  "references"
];

export const MANDATE_SECTION_LABELS: Record<MandateSectionKey, string> = {
  missionStatement: "Mission Statement",
  structure: "Structure",
  jointGivingPolicy: "Joint Giving Policy",
  discretionaryGivingPolicy: "Discretionary Giving Policy",
  process: "Process",
  annualCycle: "Annual Cycle",
  rolesAndResponsibilities: "Roles & Responsibilities",
  references: "References"
};

export const DEFAULT_MANDATE_POLICY_CONTENT: MandatePolicyContent = {
  missionStatement:
    "The Brosens Family Foundation provides economic opportunities to disenfranchised communities and people in order to help bridge societal gaps in human equity, with a practical focus on education-related outcomes.",
  structure: [
    "The foundation currently operates as a non-operating entity and executes donations through Brynn (Admin role).",
    "Annual giving defaults to a 75% joint pool and 25% discretionary pool, based on the configured budget record for the year.",
    "Unused budget can be carried and managed through yearly rollover settings."
  ].join("\n"),
  jointGivingPolicy: [
    "Joint proposals are reviewed case-by-case across a broad mandate rather than a single cause area.",
    "Voting is blind until reveal in Meeting stage.",
    "Current app rule: final joint amount is the sum of eligible allocation votes (not an average).",
    "Joint proposals move through To Review -> Approved/Declined -> Sent."
  ].join("\n"),
  discretionaryGivingPolicy: [
    "A discretionary pool exists for individual proposal ownership.",
    "Current app rule: proposer cannot vote on their own discretionary proposal.",
    "Current app rule: any \"no\" vote from a non-proposer voter auto-declines the proposal.",
    "Current app rule: proposal auto-approves only when all eligible non-proposer voters vote \"yes\".",
    "Current app rule: final discretionary amount is proposer-set.",
    "Current app workspace cap: per-user discretionary cap is min($5,000,000, discretionary_pool / voting_members)."
  ].join("\n"),
  process: [
    "1) Add proposal details and supporting context.",
    "2) Notify members that voting is open.",
    "3) Collect blind votes from eligible voters.",
    "4) Use Meeting stage to reveal votes when needed and confirm the final decision.",
    "5) Approved proposals appear in Brynn's Admin queue for execution."
  ].join("\n"),
  annualCycle: [
    "January: review period for improvements to policy/process.",
    "February 1: annual reset point for active budget cycle.",
    "December 31: year-end allocation deadline for the cycle."
  ].join("\n"),
  rolesAndResponsibilities: [
    "Brynn (Admin): executes approved donations and marks proposals as Sent.",
    "Tom (Oversight): process oversight and policy maintenance.",
    "Dad (Manager): co-approves meeting decisions and manages foundation-level budget direction."
  ].join("\n"),
  references: [
    "Brosens Family Foundation Master Document",
    "Brosens Foundation working documents",
    "Brosens Family Foundation Grants master tracking sheets"
  ].join("\n")
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").trim();
}

export function normalizeMandatePolicyContent(input: unknown): MandatePolicyContent {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    missionStatement: normalizeText(source.missionStatement),
    structure: normalizeText(source.structure),
    jointGivingPolicy: normalizeText(source.jointGivingPolicy),
    discretionaryGivingPolicy: normalizeText(source.discretionaryGivingPolicy),
    process: normalizeText(source.process),
    annualCycle: normalizeText(source.annualCycle),
    rolesAndResponsibilities: normalizeText(source.rolesAndResponsibilities),
    references: normalizeText(source.references)
  };
}

export function applyMandateDefaults(content: MandatePolicyContent): MandatePolicyContent {
  return {
    missionStatement: content.missionStatement || DEFAULT_MANDATE_POLICY_CONTENT.missionStatement,
    structure: content.structure || DEFAULT_MANDATE_POLICY_CONTENT.structure,
    jointGivingPolicy: content.jointGivingPolicy || DEFAULT_MANDATE_POLICY_CONTENT.jointGivingPolicy,
    discretionaryGivingPolicy:
      content.discretionaryGivingPolicy || DEFAULT_MANDATE_POLICY_CONTENT.discretionaryGivingPolicy,
    process: content.process || DEFAULT_MANDATE_POLICY_CONTENT.process,
    annualCycle: content.annualCycle || DEFAULT_MANDATE_POLICY_CONTENT.annualCycle,
    rolesAndResponsibilities:
      content.rolesAndResponsibilities || DEFAULT_MANDATE_POLICY_CONTENT.rolesAndResponsibilities,
    references: content.references || DEFAULT_MANDATE_POLICY_CONTENT.references
  };
}

export function buildMandateSectionDiffs(
  previous: MandatePolicyContent,
  next: MandatePolicyContent
): MandateSectionDiff[] {
  const diffs: MandateSectionDiff[] = [];

  for (const key of MANDATE_SECTION_ORDER) {
    const before = normalizeText(previous[key]);
    const after = normalizeText(next[key]);

    if (before === after) {
      continue;
    }

    diffs.push({
      key,
      label: MANDATE_SECTION_LABELS[key],
      before,
      after
    });
  }

  return diffs;
}

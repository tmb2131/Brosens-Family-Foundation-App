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
    "The Brosens Family Foundation supports people and communities that have been left out of economic opportunity. Our practical focus is education, as a means to create long-term pathways to social equity.",
  structure: [
    "The foundation operates as a non-operating entity.",
    "Annual giving defaults to a 75% joint pool and 25% discretionary pool, based on that year's budget record.",
    "Unused budget can roll over to future years through yearly rollover settings."
  ].join("\n"),
  jointGivingPolicy: [
    "Joint proposals are reviewed case-by-case across the full mandate, not limited to one cause area.",
    "Voting stays blind.",
    "The final joint amount is the sum of eligible allocation votes (not an average).",
    "Joint proposals move through To Review -> Approved/Declined -> Sent."
  ].join("\n"),
  discretionaryGivingPolicy: [
    "The discretionary pool supports proposals owned by individual members.",
    "Proposers cannot vote on their own discretionary proposals.",
    'Non-proposer voters select "Acknowledged" or "Flag for Discussion".',
    "Discretionary proposals stay To Review until they are discussed in Meeting.",
    "The final decision is approved or rejected by the Oversight admin in Meeting.",
    "The final discretionary amount is proposer-set for approved proposals.",
    "Per-user discretionary cap is min($5,000,000, discretionary_pool / voting_members)."
  ].join("\n"),
  process: [
    "1) Create a proposal with key details and supporting context.",
    "2) Notify members that voting is open.",
    "3) Collect blind votes from eligible voters.",
    "4) In the Meeting stage, reveal votes as needed and confirm the final decision.",
    "5) Approved proposals move to Brynn's Admin queue for execution."
  ].join("\n"),
  annualCycle: [
    "January: review and improve policy and process.",
    "February 1: start of the annual budget cycle.",
    "December 31: deadline for year-end allocations."
  ].join("\n"),
  rolesAndResponsibilities: [
    "Brynn (Admin): executes approved donations and marks proposals as Sent.",
    "Tom (Oversight): maintains policy, oversees process, and approves or declines discretionary proposals during meetings.",
    "Dad (Manager): sets foundation-level budget direction."
  ].join("\n"),
  references: [
    "Brosens Family Foundation Master Document",
    "Brosens Foundation working documents",
    "Brosens Family Foundation grants master tracking sheets"
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

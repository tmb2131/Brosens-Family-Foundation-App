import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import {
  HistoricalProposalImportRow,
  importHistoricalProposals
} from "@/lib/foundation-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { AllocationMode, ProposalStatus, ProposalType } from "@/lib/types";

const PROPOSAL_STATUSES: ProposalStatus[] = ["to_review", "approved", "sent", "declined"];
const PROPOSAL_TYPES: ProposalType[] = ["joint", "discretionary"];
const ALLOCATION_MODES: AllocationMode[] = ["average", "sum"];

const HEADER_ALIASES = {
  title: ["title", "proposal_title"],
  description: ["description", "proposal_description"],
  organizationName: ["organization", "organization_name", "org", "org_name"],
  budgetYear: ["budget_year", "year"],
  finalAmount: ["final_amount", "amount", "awarded_amount", "total_amount"],
  status: ["status", "proposal_status"],
  proposalType: ["proposal_type", "type"],
  allocationMode: ["allocation_mode", "mode"],
  notes: ["notes"],
  sentAt: ["sent_at", "sent_date", "date_sent", "date_amount_sent"],
  createdAt: ["created_at", "submitted_at", "date"],
  website: ["website", "organization_website"],
  causeArea: ["cause_area", "cause"],
  charityNavigatorScore: ["charity_navigator_score", "charity_score", "cn_score"]
} as const;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (insideQuotes) {
      if (char === "\"") {
        if (csvText[index + 1] === "\"") {
          currentCell += "\"";
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === "\"") {
      insideQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentCell += char;
  }

  if (insideQuotes) {
    throw new HttpError(400, "Malformed CSV: missing closing quote.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  return aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
}

function parseOptionalNumber(rawValue: string, lineNumber: number, fieldLabel: string) {
  if (!rawValue.trim()) {
    return undefined;
  }

  const parsed = Number(rawValue.trim().replace(/[$,\s]+/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `Row ${lineNumber}: ${fieldLabel} must be a number.`);
  }

  return parsed;
}

function parseCsvImportRows(csvText: string): HistoricalProposalImportRow[] {
  const rows = parseCsvRows(csvText);
  if (!rows.length) {
    throw new HttpError(400, "CSV is empty.");
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));

  const headerIndexes = {
    title: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.title),
    description: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.description),
    organizationName: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.organizationName),
    budgetYear: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.budgetYear),
    finalAmount: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.finalAmount),
    status: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.status),
    proposalType: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.proposalType),
    allocationMode: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.allocationMode),
    notes: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.notes),
    sentAt: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.sentAt),
    createdAt: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.createdAt),
    website: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.website),
    causeArea: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.causeArea),
    charityNavigatorScore: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.charityNavigatorScore)
  };

  if (
    headerIndexes.title < 0 ||
    headerIndexes.organizationName < 0 ||
    headerIndexes.budgetYear < 0 ||
    headerIndexes.finalAmount < 0
  ) {
    throw new HttpError(
      400,
      "CSV is missing required headers. Required: title, organization, budget_year, final_amount."
    );
  }

  const getCell = (row: string[], index: number) => (index < 0 ? "" : String(row[index] ?? "").trim());

  const parsedRows: HistoricalProposalImportRow[] = [];

  dataRows.forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    if (row.every((cell) => !cell.trim())) {
      return;
    }

    const title = getCell(row, headerIndexes.title);
    const description = getCell(row, headerIndexes.description);
    const organizationName = getCell(row, headerIndexes.organizationName);
    const budgetYearRaw = getCell(row, headerIndexes.budgetYear);
    const finalAmountRaw = getCell(row, headerIndexes.finalAmount);
    const notes = getCell(row, headerIndexes.notes);
    const sentAtRaw = getCell(row, headerIndexes.sentAt);
    const createdAtRaw = getCell(row, headerIndexes.createdAt);
    const website = getCell(row, headerIndexes.website);
    const causeArea = getCell(row, headerIndexes.causeArea);
    const charityNavigatorScoreRaw = getCell(row, headerIndexes.charityNavigatorScore);

    if (!title || !organizationName || !budgetYearRaw || !finalAmountRaw) {
      throw new HttpError(
        400,
        `Row ${lineNumber}: title, organization, budget_year, and final_amount are required.`
      );
    }

    const budgetYear = Number(budgetYearRaw);
    if (!Number.isInteger(budgetYear) || budgetYear < 1900 || budgetYear > 3000) {
      throw new HttpError(400, `Row ${lineNumber}: budget_year must be a valid year.`);
    }

    const finalAmount = Number(finalAmountRaw.replace(/[$,\s]+/g, ""));
    if (!Number.isFinite(finalAmount) || finalAmount < 0) {
      throw new HttpError(400, `Row ${lineNumber}: final_amount must be a non-negative number.`);
    }

    const statusRaw = getCell(row, headerIndexes.status).toLowerCase();
    const status: ProposalStatus = statusRaw
      ? PROPOSAL_STATUSES.includes(statusRaw as ProposalStatus)
        ? (statusRaw as ProposalStatus)
        : (() => {
            throw new HttpError(
              400,
              `Row ${lineNumber}: status must be one of ${PROPOSAL_STATUSES.join(", ")}.`
            );
          })()
      : "sent";

    const proposalTypeRaw = getCell(row, headerIndexes.proposalType).toLowerCase();
    const proposalType: ProposalType = proposalTypeRaw
      ? PROPOSAL_TYPES.includes(proposalTypeRaw as ProposalType)
        ? (proposalTypeRaw as ProposalType)
        : (() => {
            throw new HttpError(
              400,
              `Row ${lineNumber}: proposal_type must be one of ${PROPOSAL_TYPES.join(", ")}.`
            );
          })()
      : "joint";

    const allocationModeRaw = getCell(row, headerIndexes.allocationMode).toLowerCase();
    const parsedAllocationMode: AllocationMode = allocationModeRaw
      ? ALLOCATION_MODES.includes(allocationModeRaw as AllocationMode)
        ? (allocationModeRaw as AllocationMode)
        : (() => {
            throw new HttpError(
              400,
              `Row ${lineNumber}: allocation_mode must be one of ${ALLOCATION_MODES.join(", ")}.`
            );
          })()
      : "sum";

    const allocationMode: AllocationMode =
      proposalType === "joint" ? "sum" : parsedAllocationMode;

    let createdAt: string | undefined;
    if (createdAtRaw) {
      const timestamp = Date.parse(createdAtRaw);
      if (Number.isNaN(timestamp)) {
        throw new HttpError(
          400,
          `Row ${lineNumber}: created_at must be a valid date or ISO timestamp.`
        );
      }
      createdAt = new Date(timestamp).toISOString();
    }

    let sentAt: string | undefined;
    if (sentAtRaw) {
      const timestamp = Date.parse(sentAtRaw);
      if (Number.isNaN(timestamp)) {
        throw new HttpError(
          400,
          `Row ${lineNumber}: sent_at must be a valid date or ISO timestamp.`
        );
      }
      sentAt = new Date(timestamp).toISOString().slice(0, 10);
    }

    const charityNavigatorScore = parseOptionalNumber(
      charityNavigatorScoreRaw,
      lineNumber,
      "charity_navigator_score"
    );

    parsedRows.push({
      title,
      description,
      organizationName,
      budgetYear,
      finalAmount,
      status,
      proposalType,
      allocationMode,
      notes,
      ...(sentAt ? { sentAt } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(website ? { website } : {}),
      ...(causeArea ? { causeArea } : {}),
      ...(charityNavigatorScore !== undefined ? { charityNavigatorScore } : {})
    });
  });

  if (!parsedRows.length) {
    throw new HttpError(400, "CSV contains no importable data rows.");
  }

  return parsedRows;
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight"]);

    const body = await request.json();
    const csvText = typeof body.csvText === "string" ? body.csvText : "";

    if (!csvText.trim()) {
      throw new HttpError(400, "CSV payload is required.");
    }

    if (csvText.length > 2_000_000) {
      throw new HttpError(400, "CSV payload is too large. Maximum size is 2MB.");
    }

    const rows = parseCsvImportRows(csvText);
    const result = await importHistoricalProposals(admin, {
      rows,
      importedByUserId: profile.id
    });

    return NextResponse.json({
      importedCount: result.insertedCount,
      skippedCount: result.skippedCount,
      receivedCount: rows.length
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

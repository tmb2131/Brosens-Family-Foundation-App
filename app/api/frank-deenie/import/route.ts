import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { normalizeHeader, parseCsvRows, findHeaderIndex } from "@/lib/csv";
import { FrankDeenieImportRow, importFrankDeenieDonations } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";

const HEADER_ALIASES = {
  date: ["date", "donation_date"],
  type: ["type", "donation_type"],
  name: ["name", "recipient", "recipient_name", "organization"],
  memo: ["memo", "memo_description", "description", "notes"],
  split: ["split"],
  amount: ["amount", "donation_amount", "amount_usd"],
  status: ["status"]
} as const;

function parseCsvImportRows(csvText: string): FrankDeenieImportRow[] {
  const rows = parseCsvRows(csvText);
  if (!rows.length) {
    throw new HttpError(400, "CSV is empty.");
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));

  const headerIndexes = {
    date: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.date),
    type: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.type),
    name: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.name),
    memo: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.memo),
    split: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.split),
    amount: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.amount),
    status: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.status)
  };

  if (headerIndexes.date < 0 || headerIndexes.name < 0 || headerIndexes.amount < 0) {
    throw new HttpError(400, "CSV is missing required headers. Required: date, name, amount.");
  }

  const getCell = (row: string[], index: number) => (index < 0 ? "" : String(row[index] ?? "").trim());
  const parsedRows: FrankDeenieImportRow[] = [];

  dataRows.forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    if (row.every((cell) => !cell.trim())) {
      return;
    }

    const date = getCell(row, headerIndexes.date);
    const name = getCell(row, headerIndexes.name);
    const amountRaw = getCell(row, headerIndexes.amount);
    const type = getCell(row, headerIndexes.type);
    const memo = getCell(row, headerIndexes.memo);
    const split = getCell(row, headerIndexes.split);
    const status = getCell(row, headerIndexes.status);

    if (!date || !name || !amountRaw) {
      throw new HttpError(400, `Row ${lineNumber}: date, name, and amount are required.`);
    }

    const amount = Number(amountRaw.replace(/[$,\s]+/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      throw new HttpError(400, `Row ${lineNumber}: amount must be a non-negative number.`);
    }

    parsedRows.push({
      date,
      name,
      amount,
      ...(type ? { type } : {}),
      ...(memo ? { memo } : {}),
      ...(split ? { split } : {}),
      ...(status ? { status } : {})
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
    const result = await importFrankDeenieDonations(admin, {
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

import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import {
  deleteProposalDraft,
  draftPayloadHasContent,
  getProposalDraft,
  parseProposalDraftPayload,
  upsertProposalDraft
} from "@/lib/proposal-draft-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["member", "oversight", "manager", "admin"]);

    const draft = await getProposalDraft(admin, profile.id);

    return NextResponse.json({ draft });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["member", "oversight", "manager", "admin"]);

    const body = await request.json().catch(() => null);
    const payload = parseProposalDraftPayload(body);

    if (!draftPayloadHasContent(payload)) {
      await deleteProposalDraft(admin, profile.id);
      return NextResponse.json({ ok: true });
    }

    await upsertProposalDraft(admin, profile.id, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["member", "oversight", "manager", "admin"]);

    await deleteProposalDraft(admin, profile.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

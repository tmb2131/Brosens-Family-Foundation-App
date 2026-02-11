// Edge Function stub: notify Brynn when proposal status transitions to approved.
// Trigger this from database webhooks or app workflow.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const payload = await req.json().catch(() => null);

  if (!payload?.proposalId) {
    return new Response(JSON.stringify({ error: "proposalId is required" }), { status: 400 });
  }

  // Replace with email/slack integration for Brynn execution cues.
  return new Response(JSON.stringify({ ok: true, message: "Admin notified", payload }), {
    headers: { "content-type": "application/json" }
  });
});

/**
 * Prints what would be included in today's daily digest (America/New_York).
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. from .env.local).
 *
 * Run: npx tsx scripts/daily-digest-preview.ts
 * Or with env: node --env-file=.env.local --import tsx scripts/daily-digest-preview.ts
 */

import { createAdminClient } from "../lib/supabase/admin";
import { getDailyDigestPreview } from "../lib/email-notifications";
import { currency } from "../lib/utils";

function loadEnvLocal() {
  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

async function main() {
  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)."
    );
    process.exit(1);
  }

  const preview = await getDailyDigestPreview(admin);
  const sent = preview.proposals;
  const outstanding = preview.outstanding;

  console.log("Daily digest preview (America/New_York)");
  console.log("Day:", preview.dayKey);
  console.log("");

  console.log("Donations marked Sent today:");
  if (sent.length === 0) {
    console.log("  (none)");
  } else {
    for (const p of sent) {
      const amountStr = currency(p.amount);
      const sentOn = p.sentAt
        ? new Date(p.sentAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
        : preview.dayKey;
      console.log(`  - ${p.title} — ${amountStr} sent on ${sentOn}`);
    }
  }

  console.log("");
  console.log("Still outstanding (approved, not yet marked Sent):");
  if (outstanding.length === 0) {
    console.log("  (none)");
  } else {
    for (const p of outstanding) {
      console.log(`  - ${p.title}`);
    }
  }

  console.log("");
  if (sent.length === 0 && outstanding.length === 0) {
    console.log("No digest email would be sent (no proposals marked sent today).");
  } else {
    console.log(
      `Digest would include ${sent.length} sent and ${outstanding.length} outstanding. Email is only sent when at least one proposal was marked sent today.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-off: fetch Charity Navigator encompass scores for all proposals (and their
 * organizations) that have a Charity Navigator URL. Updates organizations.charity_navigator_score
 * (and charity_navigator_url if null).
 *
 * Requires CHARITY_NAVIGATOR_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (e.g. from .env.local).
 *
 * Run: npx tsx scripts/fetch-charity-navigator-scores.ts
 */

import { createAdminClient } from "../lib/supabase/admin";
import { runCharityNavigatorScoreBackfill } from "../lib/charity-navigator";

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

  if (!process.env.CHARITY_NAVIGATOR_API_KEY?.trim()) {
    console.error("CHARITY_NAVIGATOR_API_KEY is not set. Add it to .env.local and try again.");
    process.exit(1);
  }

  const result = await runCharityNavigatorScoreBackfill(admin);
  console.log("Done. Updated:", result.updated, "Skipped:", result.skipped, "Failed:", result.failed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http-error";
import {
  DirectionalCategory,
  DIRECTIONAL_CATEGORY_LABELS,
  DirectionalCategorySource,
  DIRECTIONAL_CATEGORIES
} from "@/lib/types";

type AdminClient = SupabaseClient;
type OrganizationCategoryJobStatus = "pending" | "processing" | "completed" | "failed";

const MAX_CATEGORY_JOB_ATTEMPTS = 5;
const DEFAULT_CATEGORY_JOB_LIMIT = 25;

const DIRECTIONAL_CATEGORY_SET = new Set<string>(DIRECTIONAL_CATEGORIES);
const DIRECTIONAL_CATEGORY_SOURCE_SET = new Set<string>(["rule", "ai", "manual", "fallback"]);

const CATEGORY_RULE_KEYWORDS: Record<DirectionalCategory, string[]> = {
  arts_culture: [
    "arts",
    "art",
    "culture",
    "humanities",
    "museum",
    "music",
    "media",
    "theater",
    "theatre",
    "dance",
    "heritage",
    "history",
    "literature",
    "library",
    "libraries"
  ],
  education: [
    "education",
    "school",
    "student",
    "students",
    "literacy",
    "learning",
    "academy",
    "scholar",
    "scholarship",
    "scholarships",
    "college",
    "university",
    "stem"
  ],
  health: [
    "health",
    "medical",
    "medicine",
    "hospital",
    "clinic",
    "mental",
    "wellness",
    "care",
    "patient",
    "cancer",
    "disease"
  ],
  environment: [
    "environment",
    "climate",
    "conservation",
    "wildlife",
    "forest",
    "ocean",
    "water",
    "nature",
    "sustainability",
    "earth",
    "animal",
    "animals",
    "vet",
    "veterinary",
    "sanctuary",
    "park",
    "parks"
  ],
  housing: [
    "housing",
    "shelter",
    "homeless",
    "home",
    "homes",
    "tenant",
    "rent",
    "residence",
    "food",
    "hunger",
    "meal",
    "meals",
    "nutrition",
    "pantry",
    "kitchen",
    "feeding",
    "foodbank",
    "youth",
    "job",
    "training",
    "workforce",
    "services",
    "support"
  ],
  international_aid: [
    "international",
    "global",
    "refugee",
    "humanitarian",
    "world",
    "relief",
    "disaster",
    "aid",
    "poverty",
    "development",
    "foreign",
    "rights"
  ],
  food_security: [
    "civil",
    "rights",
    "community",
    "foundation",
    "foundations",
    "public",
    "societal",
    "benefit",
    "policy",
    "advocacy",
    "legal",
    "justice",
    "democracy",
    "civic"
  ],
  other: []
};

const CATEGORY_AI_GUIDANCE: Record<DirectionalCategory, string> = {
  arts_culture: "Arts, Culture & Humanities (museums, performing arts, media, humanities).",
  education: "Education (schools, universities, PTAs, libraries, scholarships).",
  environment: "Environment & Animals (parks, conservation, wildlife sanctuaries, vet services).",
  health: "Health (hospitals, mental health, medical research, public health).",
  housing: "Human Services (housing, food banks, youth centers, job training, social services).",
  international_aid: "International & Foreign Affairs (human rights, relief, international development).",
  food_security: "Public & Societal Benefit (civil rights, legal advocacy, community foundations).",
  other: "Other (does not strongly fit the categories above)."
};

interface OrganizationForCategorizationRow {
  id: string;
  name: string;
  website: string | null;
  charity_navigator_url: string | null;
  directional_category_locked: boolean;
}

interface OrganizationCategoryJobRow {
  id: string;
  organization_id: string;
  status: OrganizationCategoryJobStatus;
  attempt_count: number;
}

interface ClassificationResult {
  category: DirectionalCategory;
  source: DirectionalCategorySource;
  confidence: number | null;
}

export interface OrganizationCategoryRecord {
  id: string;
  name: string;
  directionalCategory: DirectionalCategory;
  directionalCategorySource: DirectionalCategorySource;
  directionalCategoryConfidence: number | null;
  directionalCategoryLocked: boolean;
  directionalCategoryUpdatedAt: string | null;
}

export interface ProcessOrganizationCategoryJobsResult {
  processed: number;
  categorized: number;
  skippedLocked: number;
  failed: number;
  pendingRetries: number;
}

function toDirectionalCategory(value: unknown): DirectionalCategory {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (DIRECTIONAL_CATEGORY_SET.has(normalized)) {
    return normalized as DirectionalCategory;
  }

  const collapsed = normalized
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const aliasMap: Record<string, DirectionalCategory> = {
    "arts culture humanities": "arts_culture",
    "arts and culture humanities": "arts_culture",
    "environment animals": "environment",
    "environment and animals": "environment",
    "human services": "housing",
    "international foreign affairs": "international_aid",
    "international and foreign affairs": "international_aid",
    "public societal benefit": "food_security",
    "public and societal benefit": "food_security"
  };

  const aliased = aliasMap[collapsed];
  if (aliased) {
    return aliased;
  }
  return "other";
}

function toDirectionalCategorySource(value: unknown): DirectionalCategorySource {
  const normalized = String(value ?? "").trim();
  if (DIRECTIONAL_CATEGORY_SOURCE_SET.has(normalized)) {
    return normalized as DirectionalCategorySource;
  }
  return "fallback";
}

function toConfidence(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 0 || parsed > 1) {
    return null;
  }
  return Math.round(parsed * 1000) / 1000;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitIntoTokens(value: string) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function tokenizeUrl(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname;
    return splitIntoTokens(`${host} ${path}`);
  } catch {
    return splitIntoTokens(value);
  }
}

function classifyWithRules(input: {
  organizationName: string;
  website?: string | null;
  charityNavigatorUrl?: string | null;
}) {
  const tokenSet = new Set<string>([
    ...splitIntoTokens(input.organizationName),
    ...tokenizeUrl(input.website),
    ...tokenizeUrl(input.charityNavigatorUrl)
  ]);

  if (!tokenSet.size) {
    return null;
  }

  const scores = new Map<DirectionalCategory, number>();
  for (const category of DIRECTIONAL_CATEGORIES) {
    let score = 0;
    for (const keyword of CATEGORY_RULE_KEYWORDS[category]) {
      for (const token of tokenSet) {
        if (token === keyword || token.includes(keyword) || keyword.includes(token)) {
          score += 1;
          break;
        }
      }
    }
    scores.set(category, score);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topEntry, secondEntry] = ranked;
  if (!topEntry) {
    return null;
  }

  const [topCategory, topScore] = topEntry;
  const secondScore = secondEntry?.[1] ?? 0;
  if (topScore <= 0) {
    return null;
  }

  const scoreGap = topScore - secondScore;
  if (scoreGap <= 0) {
    return null;
  }

  const confidence = Math.min(0.95, 0.55 + scoreGap * 0.08 + Math.min(topScore, 6) * 0.03);
  if (confidence < 0.6) {
    return null;
  }

  return {
    category: topCategory,
    source: "rule" as const,
    confidence: Math.round(confidence * 1000) / 1000
  };
}

function stripCodeFences(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseAiClassificationResponse(parsed: { category?: unknown; confidence?: unknown }) {
  const rawCategory = String(parsed.category ?? "")
    .trim()
    .toLowerCase();
  const category = toDirectionalCategory(rawCategory);
  if (category === "other" && rawCategory && rawCategory !== "other") {
    return null;
  }

  return {
    category,
    source: "ai" as const,
    confidence: toConfidence(parsed.confidence) ?? 0.65
  };
}

function tryResolveHostname(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function truncateForPrompt(value: string, maxLength = 220) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

async function lookupSerperContext(input: {
  organizationName: string;
  website?: string | null;
}) {
  const apiKey = process.env.SERPER_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return [] as string[];
  }

  const queryParts = [input.organizationName.trim(), tryResolveHostname(input.website), "nonprofit mission"];
  const query = queryParts.filter(Boolean).join(" ");
  if (!query) {
    return [] as string[];
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        q: query,
        num: 5
      })
    });

    if (!response.ok) {
      return [] as string[];
    }

    const payload = (await response.json()) as {
      answerBox?: { title?: string; answer?: string; snippet?: string };
      knowledgeGraph?: { title?: string; type?: string; description?: string };
      organic?: Array<{ title?: string; snippet?: string; link?: string }>;
    };

    const snippets: string[] = [];

    if (payload.answerBox) {
      const answerBoxLine = [payload.answerBox.title, payload.answerBox.answer, payload.answerBox.snippet]
        .filter(Boolean)
        .join(" | ");
      if (answerBoxLine) {
        snippets.push(truncateForPrompt(answerBoxLine));
      }
    }

    if (payload.knowledgeGraph) {
      const knowledgeLine = [
        payload.knowledgeGraph.title,
        payload.knowledgeGraph.type,
        payload.knowledgeGraph.description
      ]
        .filter(Boolean)
        .join(" | ");
      if (knowledgeLine) {
        snippets.push(truncateForPrompt(knowledgeLine));
      }
    }

    for (const item of payload.organic ?? []) {
      if (snippets.length >= 5) {
        break;
      }
      const line = [item.title, item.snippet, item.link].filter(Boolean).join(" | ");
      if (line) {
        snippets.push(truncateForPrompt(line));
      }
    }

    return snippets.slice(0, 5);
  } catch {
    return [] as string[];
  }
}

function buildAiPrompt(
  input: {
    organizationName: string;
    website?: string | null;
    charityNavigatorUrl?: string | null;
  },
  serperContext: string[]
) {
  const contextBlock = serperContext.length
    ? serperContext.map((snippet, index) => `${index + 1}. ${snippet}`).join("\n")
    : "(none)";
  const categoryGuide = DIRECTIONAL_CATEGORIES.map(
    (category) =>
      `- ${category} (${DIRECTIONAL_CATEGORY_LABELS[category]}): ${CATEGORY_AI_GUIDANCE[category]}`
  ).join("\n");

  return [
    "Classify the organization into exactly one directional category.",
    `Allowed category keys: ${DIRECTIONAL_CATEGORIES.join(", ")}.`,
    "Use the key values exactly in JSON output.",
    `Category guide:\n${categoryGuide}`,
    "Return strict JSON with keys: category, confidence.",
    'Example: {"category":"education","confidence":0.82}',
    `Organization name: ${input.organizationName || "(blank)"}`,
    `Organization website: ${input.website || "(blank)"}`,
    `Charity Navigator URL: ${input.charityNavigatorUrl || "(blank)"}`,
    `Web search context (Serper):\n${contextBlock}`
  ].join("\n");
}

async function classifyWithGeminiFallback(
  input: {
    organizationName: string;
    website?: string | null;
    charityNavigatorUrl?: string | null;
  },
  serperContext: string[]
) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const prompt = buildAiPrompt(input, serperContext);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json"
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!text) {
      return null;
    }

    const parsed = JSON.parse(stripCodeFences(text)) as { category?: unknown; confidence?: unknown };
    return parseAiClassificationResponse(parsed);
  } catch {
    return null;
  }
}

async function classifyWithOpenAiFallback(
  input: {
    organizationName: string;
    website?: string | null;
    charityNavigatorUrl?: string | null;
  },
  serperContext: string[]
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const prompt = buildAiPrompt(input, serperContext);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You classify nonprofit organizations into one of the allowed directional categories."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(stripCodeFences(content)) as { category?: unknown; confidence?: unknown };
    return parseAiClassificationResponse(parsed);
  } catch {
    return null;
  }
}

async function classifyWithAiFallback(input: {
  organizationName: string;
  website?: string | null;
  charityNavigatorUrl?: string | null;
}) {
  const serperContext = await lookupSerperContext(input);

  const geminiResult = await classifyWithGeminiFallback(input, serperContext);
  if (geminiResult) {
    return geminiResult;
  }

  const openAiResult = await classifyWithOpenAiFallback(input, serperContext);
  if (openAiResult) {
    return openAiResult;
  }

  return null;
}

async function classifyOrganizationDirectionalCategory(input: {
  organizationName: string;
  website?: string | null;
  charityNavigatorUrl?: string | null;
}): Promise<ClassificationResult> {
  const ruled = classifyWithRules(input);
  if (ruled) {
    return ruled;
  }

  const aiResult = await classifyWithAiFallback(input);
  if (aiResult) {
    return aiResult;
  }

  return {
    category: "other",
    source: "fallback",
    confidence: null
  };
}

function truncateErrorMessage(message: string) {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

function resolveNextRetryAt(attemptCount: number) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function normalizeJobLimit(limit?: number) {
  if (limit === undefined) {
    return DEFAULT_CATEGORY_JOB_LIMIT;
  }

  if (!Number.isFinite(limit)) {
    return DEFAULT_CATEGORY_JOB_LIMIT;
  }

  return Math.max(1, Math.min(200, Math.floor(limit)));
}

export async function enqueueOrganizationCategoryJob(admin: AdminClient, organizationId: string) {
  const normalizedOrganizationId = organizationId.trim();
  if (!normalizedOrganizationId) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("organization_category_jobs").upsert(
    {
      organization_id: normalizedOrganizationId,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: now,
      last_error: null
    },
    { onConflict: "organization_id" }
  );

  if (error) {
    throw new HttpError(500, `Could not enqueue organization category job: ${error.message}`);
  }
}

export async function enqueueOrganizationCategoryJobs(admin: AdminClient, organizationIds: string[]) {
  const uniqueOrganizationIds = [...new Set(organizationIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueOrganizationIds.length) {
    return;
  }

  const now = new Date().toISOString();
  const payload = uniqueOrganizationIds.map((organizationId) => ({
    organization_id: organizationId,
    status: "pending",
    attempt_count: 0,
    next_attempt_at: now,
    last_error: null
  }));

  const { error } = await admin
    .from("organization_category_jobs")
    .upsert(payload, { onConflict: "organization_id" });

  if (error) {
    throw new HttpError(500, `Could not enqueue organization category jobs: ${error.message}`);
  }
}

export async function listOrganizationsWithDirectionalCategory(admin: AdminClient) {
  const { data, error } = await admin
    .from("organizations")
    .select(
      "id, name, directional_category, directional_category_source, directional_category_confidence, directional_category_locked, directional_category_updated_at"
    )
    .order("name", { ascending: true })
    .returns<
      Array<{
        id: string;
        name: string;
        directional_category: string | null;
        directional_category_source: string | null;
        directional_category_confidence: number | null;
        directional_category_locked: boolean;
        directional_category_updated_at: string | null;
      }>
    >();

  if (error) {
    throw new HttpError(500, `Could not load organizations for category overrides: ${error.message}`);
  }

  return (data ?? []).map((row): OrganizationCategoryRecord => ({
    id: row.id,
    name: row.name,
    directionalCategory: toDirectionalCategory(row.directional_category),
    directionalCategorySource: toDirectionalCategorySource(row.directional_category_source),
    directionalCategoryConfidence: toConfidence(row.directional_category_confidence),
    directionalCategoryLocked: Boolean(row.directional_category_locked),
    directionalCategoryUpdatedAt: row.directional_category_updated_at
  }));
}

export async function updateOrganizationDirectionalCategory(
  admin: AdminClient,
  input: {
    organizationId: string;
    category?: DirectionalCategory;
    lock?: boolean;
  }
) {
  const normalizedOrganizationId = input.organizationId.trim();
  if (!normalizedOrganizationId) {
    throw new HttpError(400, "organizationId is required.");
  }

  if (input.category === undefined && input.lock === undefined) {
    throw new HttpError(400, "At least one of category or lock must be provided.");
  }

  const updates: Record<string, unknown> = {
    directional_category_updated_at: new Date().toISOString()
  };

  if (input.category !== undefined) {
    updates.directional_category = input.category;
    updates.directional_category_source = "manual";
    updates.directional_category_confidence = null;
  }

  if (input.lock !== undefined) {
    updates.directional_category_locked = Boolean(input.lock);
  }

  const { data, error } = await admin
    .from("organizations")
    .update(updates)
    .eq("id", normalizedOrganizationId)
    .select(
      "id, name, directional_category, directional_category_source, directional_category_confidence, directional_category_locked, directional_category_updated_at"
    )
    .maybeSingle<{
      id: string;
      name: string;
      directional_category: string | null;
      directional_category_source: string | null;
      directional_category_confidence: number | null;
      directional_category_locked: boolean;
      directional_category_updated_at: string | null;
    }>();

  if (error) {
    throw new HttpError(500, `Could not update organization category: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, "Organization not found.");
  }

  return {
    id: data.id,
    name: data.name,
    directionalCategory: toDirectionalCategory(data.directional_category),
    directionalCategorySource: toDirectionalCategorySource(data.directional_category_source),
    directionalCategoryConfidence: toConfidence(data.directional_category_confidence),
    directionalCategoryLocked: Boolean(data.directional_category_locked),
    directionalCategoryUpdatedAt: data.directional_category_updated_at
  } satisfies OrganizationCategoryRecord;
}

export async function processPendingOrganizationCategoryJobs(
  admin: AdminClient,
  input?: { limit?: number }
): Promise<ProcessOrganizationCategoryJobsResult> {
  const limit = normalizeJobLimit(input?.limit);
  const nowIso = new Date().toISOString();

  const { data: jobs, error: jobLoadError } = await admin
    .from("organization_category_jobs")
    .select("id, organization_id, status, attempt_count")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", MAX_CATEGORY_JOB_ATTEMPTS)
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit)
    .returns<OrganizationCategoryJobRow[]>();

  if (jobLoadError) {
    throw new HttpError(500, `Could not load organization category jobs: ${jobLoadError.message}`);
  }

  const result: ProcessOrganizationCategoryJobsResult = {
    processed: 0,
    categorized: 0,
    skippedLocked: 0,
    failed: 0,
    pendingRetries: 0
  };

  for (const job of jobs ?? []) {
    result.processed += 1;

    try {
      const { error: processingError } = await admin
        .from("organization_category_jobs")
        .update({
          status: "processing",
          last_error: null
        })
        .eq("id", job.id);

      if (processingError) {
        throw new Error(`Could not lock job: ${processingError.message}`);
      }

      const { data: organization, error: organizationError } = await admin
        .from("organizations")
        .select("id, name, website, charity_navigator_url, directional_category_locked")
        .eq("id", job.organization_id)
        .maybeSingle<OrganizationForCategorizationRow>();

      if (organizationError) {
        throw new Error(`Could not load organization: ${organizationError.message}`);
      }

      if (!organization) {
        throw new Error("Organization missing for queued categorization job.");
      }

      if (organization.directional_category_locked) {
        const { error: completeLockedError } = await admin
          .from("organization_category_jobs")
          .update({
            status: "completed",
            last_error: null,
            next_attempt_at: nowIso
          })
          .eq("id", job.id);

        if (completeLockedError) {
          throw new Error(`Could not complete locked job: ${completeLockedError.message}`);
        }

        result.skippedLocked += 1;
        continue;
      }

      const classification = await classifyOrganizationDirectionalCategory({
        organizationName: organization.name,
        website: organization.website,
        charityNavigatorUrl: organization.charity_navigator_url
      });

      const { error: updateOrganizationError } = await admin
        .from("organizations")
        .update({
          directional_category: classification.category,
          directional_category_source: classification.source,
          directional_category_confidence: classification.confidence,
          directional_category_updated_at: new Date().toISOString()
        })
        .eq("id", organization.id)
        .eq("directional_category_locked", false);

      if (updateOrganizationError) {
        throw new Error(`Could not update organization category: ${updateOrganizationError.message}`);
      }

      const { error: completeJobError } = await admin
        .from("organization_category_jobs")
        .update({
          status: "completed",
          attempt_count: 0,
          last_error: null,
          next_attempt_at: nowIso
        })
        .eq("id", job.id);

      if (completeJobError) {
        throw new Error(`Could not complete categorization job: ${completeJobError.message}`);
      }

      result.categorized += 1;
    } catch (error) {
      const attemptCount = job.attempt_count + 1;
      const permanentFailure = attemptCount >= MAX_CATEGORY_JOB_ATTEMPTS;
      const message = truncateErrorMessage(error instanceof Error ? error.message : String(error));

      const { error: updateJobError } = await admin
        .from("organization_category_jobs")
        .update({
          status: "failed",
          attempt_count: attemptCount,
          last_error: message,
          next_attempt_at: permanentFailure ? nowIso : resolveNextRetryAt(attemptCount)
        })
        .eq("id", job.id);

      if (updateJobError) {
        throw new HttpError(
          500,
          `Could not persist organization category job failure: ${updateJobError.message}`
        );
      }

      if (permanentFailure) {
        result.failed += 1;
      } else {
        result.pendingRetries += 1;
      }
    }
  }

  return result;
}

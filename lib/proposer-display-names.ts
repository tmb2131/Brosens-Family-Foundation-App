/**
 * Shared mapping of proposer email → display name for admin queue and Frank & Deenie.
 * Used so both surfaces show the same friendly names (e.g. cbrosens2010@gmail.com → "Charlie").
 */
export const PROPOSER_DISPLAY_NAMES: Record<string, string> = {
  "cbrosens2010@gmail.com": "Charlie",
  "thomas.brosens@gmail.com": "Tom",
  "jbrosens92@gmail.com": "John",
  "pbb2102@gmail.com": "Peter",
  "fbrosens@taconiccap.com": "F&D",
  "bcarosella@taconiccap.com": "F&D",
  "deeniebrosens@hotmail.com": "F&D"
};

function localPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at).trim() : email.trim();
}

/** Display name for a proposer: map entry if present, otherwise email local part, otherwise "—". */
export function getProposerDisplayName(email: string | null | undefined): string {
  if (!email?.trim()) return "—";
  return PROPOSER_DISPLAY_NAMES[email] ?? localPart(email) ?? "—";
}

import { charityNavigatorRating, cn } from "@/lib/utils";

interface CharityNavigatorDetailsProps {
  url?: string | null;
  score?: number | null;
  /** Shown when there is neither a link nor a score. */
  emptyText?: string;
}

/**
 * The Charity Navigator link and hand-entered score for a proposal's
 * organization. Either can be present without the other.
 */
export function CharityNavigatorDetails({
  url,
  score,
  emptyText = "No Charity Navigator profile or score added."
}: CharityNavigatorDetailsProps) {
  const trimmedUrl = url?.trim() || null;
  const hasScore = score != null && Number.isFinite(score);

  if (!trimmedUrl && !hasScore) {
    return <span className="text-muted-foreground">{emptyText}</span>;
  }

  const rating = hasScore ? charityNavigatorRating(score) : null;

  return (
    <>
      {trimmedUrl ? (
        <a
          href={trimmedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-xs font-semibold text-blue-700 underline dark:text-blue-300"
        >
          {trimmedUrl}
        </a>
      ) : null}
      {hasScore && rating ? (
        <div className={cn("rounded-lg border border-border/70 bg-muted/50 p-2.5 text-xs", trimmedUrl && "mt-2")}>
          <p className="font-medium text-foreground">
            This charity&apos;s score is {Math.round(score)}%, earning it a {rating.starLabel} rating.
          </p>
          <p className="mt-1 text-muted-foreground">{rating.meaning}</p>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">No score entered.</p>
      )}
    </>
  );
}

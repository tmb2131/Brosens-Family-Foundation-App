import { ProposalStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const styleMap: Record<ProposalStatus, string> = {
  to_review: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200",
  sent: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200",
  declined: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200"
};

export function StatusPill({ status }: { status: ProposalStatus }) {
  return <Badge className={styleMap[status]}>{titleCase(status)}</Badge>;
}

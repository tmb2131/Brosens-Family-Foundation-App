import { AppRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const styles: Record<AppRole, string> = {
  member: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200",
  oversight: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
  admin: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200",
  manager: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-200"
};

export function RolePill({ role }: { role: AppRole }) {
  return <Badge className={styles[role]}>{titleCase(role)}</Badge>;
}

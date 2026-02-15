import { AppRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const neutralStyle = "bg-zinc-100 text-zinc-600 border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

export function RolePill({ role }: { role: AppRole }) {
  return <Badge className={neutralStyle}>{titleCase(role)}</Badge>;
}

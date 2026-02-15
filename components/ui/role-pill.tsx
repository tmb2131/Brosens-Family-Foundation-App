import { AppRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const roleStyles: Record<AppRole, string> = {
  member:
    "bg-[hsl(var(--role-member)/0.12)] text-[hsl(var(--role-member))] border-[hsl(var(--role-member)/0.25)]",
  oversight:
    "bg-[hsl(var(--role-oversight)/0.12)] text-[hsl(var(--role-oversight))] border-[hsl(var(--role-oversight)/0.25)]",
  admin:
    "bg-[hsl(var(--role-admin)/0.12)] text-[hsl(var(--role-admin))] border-[hsl(var(--role-admin)/0.25)]",
  manager:
    "bg-[hsl(var(--role-manager)/0.12)] text-[hsl(var(--role-manager))] border-[hsl(var(--role-manager)/0.25)]"
};

export function RolePill({ role }: { role: AppRole }) {
  return <Badge className={roleStyles[role]}>{titleCase(role)}</Badge>;
}

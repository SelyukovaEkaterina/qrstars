"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { Crown, Building2 } from "lucide-react";
import { formatPlanLabel } from "@/lib/plans";

interface PlanBadgeProps {
  plan: string;
  showChangeLink?: boolean;
  compact?: boolean;
}

export default function PlanBadge({
  plan,
  showChangeLink = false,
  compact = false,
}: PlanBadgeProps) {
  const label = formatPlanLabel(plan);
  const variant =
    plan === "NETWORK" ? "info" : plan === "PRO" ? "success" : "default";

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-1.5"}>
      <Badge variant={variant} className="w-fit">
        {plan === "PRO" && <Crown className="w-3 h-3 mr-1 inline" />}
        {plan === "NETWORK" && <Building2 className="w-3 h-3 mr-1 inline" />}
        {label}
      </Badge>
      {showChangeLink && (
        <Link
          href="/dashboard/subscription"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Сменить тариф →
        </Link>
      )}
    </div>
  );
}

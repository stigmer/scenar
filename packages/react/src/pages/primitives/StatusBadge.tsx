"use client";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  readonly label: string;
  readonly variant?: BadgeVariant;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: "bg-[#22c55e]/15 text-[#22c55e]",
  warning: "bg-[#eab308]/15 text-[#eab308]",
  error: "bg-[#ef4444]/15 text-[#ef4444]",
  info: "bg-[#3b82f6]/15 text-[#3b82f6]",
  neutral: "bg-[#94a3b8]/15 text-[#94a3b8]",
};

/**
 * Coloured status pill for table rows and card headers.
 *
 * Uses translucent backgrounds so it works on both light and dark
 * surfaces without needing theme-token overrides.
 */
export function StatusBadge({ label, variant = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${VARIANT_STYLES[variant]}`}
    >
      {label}
    </span>
  );
}

export type { StatusBadgeProps, BadgeVariant };

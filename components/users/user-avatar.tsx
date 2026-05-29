import { cn } from "@/lib/utils";

/** Initials from a name like "Ada Lovelace" → "AL". Falls back to email[0]. */
export function initials(fullName?: string | null, email?: string | null) {
  const src = (fullName ?? email ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Deterministic hue from a string so each user gets a consistent color. */
function hueFrom(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

const SIZE_CLASSES: Record<"xs" | "sm" | "md" | "lg", string> = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

export function UserAvatar({
  fullName,
  email,
  size = "sm",
  className,
  title,
}: {
  fullName?: string | null;
  email?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const tag = initials(fullName, email);
  const h = hueFrom(email ?? fullName ?? "?");
  return (
    <span
      title={title ?? fullName ?? email ?? undefined}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold ring-2 ring-background",
        SIZE_CLASSES[size],
        className
      )}
      style={{
        backgroundColor: `hsl(${h} 70% 92%)`,
        color: `hsl(${h} 60% 28%)`,
      }}
    >
      {tag}
    </span>
  );
}

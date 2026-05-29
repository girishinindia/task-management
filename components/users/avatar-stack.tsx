import { UserAvatar } from "./user-avatar";

export interface AvatarStackUser {
  id: string;
  full_name: string;
  email: string;
}

/** Overlapping avatars with a "+N" pill once the list overflows. */
export function AvatarStack({
  users,
  max = 3,
  size = "sm",
}: {
  users: AvatarStackUser[];
  max?: number;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  if (users.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((u) => (
        <UserAvatar
          key={u.id}
          fullName={u.full_name}
          email={u.email}
          size={size}
        />
      ))}
      {extra > 0 ? (
        <span
          className="inline-flex h-6 w-6 select-none items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background"
          title={users
            .slice(max)
            .map((u) => u.full_name)
            .join(", ")}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

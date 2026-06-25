"use client";

/**
 * A notification row on the Notifications page. Clicking it marks that one
 * notification read (POST /api/notifications/[id]/read) and tells the header
 * bell to drop its unread count, then navigates to the linked task. If the
 * notification has no link, it just marks read in place and refreshes the list.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotificationLink({
  id,
  href,
  isRead,
  className,
  children,
}: {
  id: number;
  href: string | null;
  isRead: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hasLink = !!href && href !== "#";

  function markRead() {
    if (isRead) return;
    // keepalive lets the request finish even as the page navigates away.
    fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      /* best-effort */
    });
    // Nudge the header bell to drop its unread count right away.
    window.dispatchEvent(
      new CustomEvent("notification:read", { detail: { id } })
    );
  }

  if (hasLink) {
    return (
      <Link href={href} className={className} onClick={markRead}>
        {children}
      </Link>
    );
  }

  // No destination — mark read and refresh so the row updates in place.
  return (
    <button
      type="button"
      className={cn(className, "w-full text-left")}
      onClick={() => {
        if (isRead) return;
        markRead();
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}

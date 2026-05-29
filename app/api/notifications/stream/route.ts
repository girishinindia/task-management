/**
 * Server-Sent Events stream of notifications for the current user.
 *
 * The bell connects to this endpoint via EventSource. Every ~4 seconds we
 * poll task.notifications for rows newer than the last-seen id; new rows
 * are pushed as `notification` events. A `heartbeat` event every 25s keeps
 * intermediary proxies from killing the connection.
 *
 * Why SSE instead of Supabase Realtime?
 *   - Realtime subscriptions are authenticated via Supabase Auth JWT or RLS.
 *   - We use neither — auth is custom HS256 + Redis-backed sessions, and
 *     authorization lives in app code.
 *   - SSE from our own JWT-checked route reuses the existing auth model and
 *     keeps the security boundary in one place.
 */
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { countUnread } from "@/lib/dao/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 4_000;
const HEARTBEAT_MS = 25_000;

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const me = await requireUser();

  const encoder = new TextEncoder();
  const userId = me.userId;

  // Track the highest notification id we've already delivered so each tick
  // only returns new rows.
  let lastSeenId = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(sseFrame(event, data)));
        } catch {
          // Stream already closed
        }
      }

      // Initial state: send the unread count + the highest current id so
      // subsequent polls only return newer rows.
      try {
        const [rows, unread] = await Promise.all([
          sql<{ id: number }[]>`
            select max(id)::int as id
              from task.notifications
             where user_id = ${userId}::uuid
          `,
          countUnread(userId),
        ]);
        lastSeenId = rows[0]?.id ?? 0;
        send("init", { unread_count: unread, last_id: lastSeenId });
      } catch (e) {
        send("error", {
          message: e instanceof Error ? e.message : "init failed",
        });
        controller.close();
        return;
      }

      const pollTimer: NodeJS.Timeout = setInterval(async () => {
        try {
          const fresh = await sql<
            {
              id: number;
              type: string;
              title: string;
              body: string | null;
              link: string | null;
              is_read: boolean;
              created_at: Date;
            }[]
          >`
            select id, type, title, body, link, is_read, created_at
              from task.notifications
             where user_id = ${userId}::uuid
               and id > ${lastSeenId}
             order by id asc
             limit 50
          `;
          if (fresh.length > 0) {
            for (const n of fresh) {
              send("notification", n);
              if (n.id > lastSeenId) lastSeenId = n.id;
            }
            // Also push a fresh unread count so the bell badge stays in sync.
            const unread = await countUnread(userId);
            send("unread_count", { unread_count: unread });
          }
        } catch (e) {
          send("error", {
            message: e instanceof Error ? e.message : "poll failed",
          });
        }
      }, POLL_MS);

      const heartbeatTimer: NodeJS.Timeout = setInterval(() => {
        send("heartbeat", { t: Date.now() });
      }, HEARTBEAT_MS);

      // Clean up when the client disconnects.
      req.signal.addEventListener("abort", () => {
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (NGINX, Vercel infra).
      "X-Accel-Buffering": "no",
    },
  });
}

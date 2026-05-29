/**
 * Zod schema for the transfer endpoint. Shared by client + server.
 */
import { z } from "zod";

export const transferSchema = z.object({
  /** Optional: who is the assignment being moved from. Null/undefined means
   *  the RPC just adds the new assignment without removing anyone. */
  from_user_id: z.string().uuid().nullable().optional(),
  to_user_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export type TransferInput = z.infer<typeof transferSchema>;

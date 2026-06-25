import { z } from "zod";

export const setAssignmentsSchema = z.object({
  user_ids: z.array(z.string().uuid()).max(50),
  /** Subset of user_ids to set as project admins (the rest become members).
   *  Applied server-side and only honored for super admins, since changing the
   *  admin tier is super-admin-only. */
  admin_ids: z.array(z.string().uuid()).max(50).optional(),
});

export type SetAssignmentsInput = z.infer<typeof setAssignmentsSchema>;

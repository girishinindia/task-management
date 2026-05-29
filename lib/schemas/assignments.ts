import { z } from "zod";

export const setAssignmentsSchema = z.object({
  user_ids: z.array(z.string().uuid()).max(50),
});

export type SetAssignmentsInput = z.infer<typeof setAssignmentsSchema>;

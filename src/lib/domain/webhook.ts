import { z } from "zod";

/**
 * Provider-agnostic payment webhook (PRD F17). A provider adapter (Cardcom/Grow/
 * Tranzila) translates the provider's callback into this shape and signs it,
 * or the provider's automation posts it directly.
 */
export const paymentEventSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["payment.succeeded", "payment.refunded"]),
  email: z.string().email(),
  firstName: z.string().max(100).optional().default(""),
  lastName: z.string().max(100).optional().default(""),
  cohortId: z.string().uuid().optional(),
  programSlug: z.string().max(200).optional(),
  amountAgorot: z.number().int().nonnegative().optional(),
}).refine((v) => v.cohortId || v.programSlug, { message: "cohortId or programSlug is required" });

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

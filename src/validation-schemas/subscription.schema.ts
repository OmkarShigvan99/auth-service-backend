import { z } from "zod";
import { PlanType } from "../../generated/prisma/enums";

export const subscriptionSchema = z.object({
    plan: z.enum(PlanType),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

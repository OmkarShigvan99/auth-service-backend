import { Plan, PlanType } from "../../generated/prisma/client";
import { prisma } from "../configs/prisma.config";

export async function getPlanByType(planType: PlanType): Promise<Plan | null> {
    const plan = await prisma.plan.findUnique({
        where: { type: planType },
    });
    return plan;
}

export async function createPlan(
    type: PlanType,
    maxDevices: number,
): Promise<Plan> {
    const plan = await prisma.plan.create({
        data: {
            type,
            maxDevices,
        },
    });
    return plan;
}

export async function getAllPlans(): Promise<Plan[]> {
    const plans = await prisma.plan.findMany();
    return plans;
}

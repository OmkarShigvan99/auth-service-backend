import { prisma } from "../configs/prisma.config";

interface UpdateUserSubscriptionInput {
    userId: string;
    planId: number;
}

interface CreateSubscriptionInput {
    userId: string;
    planId: number;
}

export async function createSubscription(input: CreateSubscriptionInput) {
    const { userId, planId } = input;

    const subscription = await prisma.subscription.create({
        data: {
            userId,
            planId,
        },
        select: {
            id: true,
            userId: true,
            planId: true,
            plan: true,
        },
    });

    return subscription;
}

export async function updateUserSubscription(
    input: UpdateUserSubscriptionInput,
) {
    const { userId, planId } = input;

    const subscription = await prisma.subscription.update({
        where: { userId },
        data: {
            planId,
        },
        select: {
            id: true,
            userId: true,
            planId: true,
            plan: true,
        },
    });

    return subscription;
}

export async function getSubscriptionByUser(userId: string) {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: {
            plan: {
                select: {
                    type: true,
                    maxDevices: true,
                },
            },
            id: true,
            userId: true,
            planId: true,
        },
    });
    return subscription;
}

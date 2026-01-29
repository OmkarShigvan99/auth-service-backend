import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../configs/prisma.config";
import {
    getSubscriptionByUser,
    updateUserSubscription,
} from "../services/subscription.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ApiResponse } from "../utils/ApiResponse";
import { redisClient, CACHE_KEYS } from "../configs/redis.config";

export async function updateUserSubscriptionController(
    req: AuthenticatedRequest,
    res: Response,
): Promise<void> {
    const userId = req.user?.userId;
    const { plan } = req.body;

    // check if the plan exists
    const planRecord = await prisma.plan.findUnique({
        where: { type: plan },
    });

    if (!planRecord) {
        res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: "No such plan exists",
        });
        return;
    }

    // Update subscription
    const subscription = await updateUserSubscription({
        userId: userId as string,
        planId: planRecord.id,
    });

    // Invalidate user subscription cache
    await redisClient.del(CACHE_KEYS.USER_SUBSCRIPTION(userId as string));

    res.status(StatusCodes.OK).json(
        new ApiResponse(
            StatusCodes.OK,
            "Subscription updated successfully",
            subscription,
        ),
    );
}

export async function getCurrentUserSubscriptionController(
    req: AuthenticatedRequest,
    res: Response,
): Promise<void> {
    const userId = req.user?.userId;

    // Get subscription
    const subscription = await getSubscriptionByUser(userId as string);

    if (!subscription) {
        res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: "Subscription not found for this user",
        });
        return;
    }

    res.status(StatusCodes.OK).json(
        new ApiResponse(
            StatusCodes.OK,
            "Subscription retrieved successfully",
            subscription,
        ),
    );
}

export async function getSubscriptionController(
    req: Request<{ userId: string }>,
    res: Response,
): Promise<void> {
    const { userId } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: "User not found",
        });
        return;
    }

    // Get subscription
    const subscription = await getSubscriptionByUser(userId);

    if (!subscription) {
        res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: "Subscription not found for this user",
        });
        return;
    }

    res.status(StatusCodes.OK).json(
        new ApiResponse(
            StatusCodes.OK,
            "Subscription retrieved successfully",
            subscription,
        ),
    );
}

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/errorHandler";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { redisClient, CACHE_KEYS, CACHE_TTL } from "../configs/redis.config";
import {
    getUserSubscription,
    getAvailableContentForUser,
    getContentForUser,
    getContentByTypeForUser,
    getContentByGenreForUser,
    canUserAccessContent,
    getWatchHistory,
    updateWatchProgress,
} from "../services/content.service";
import { ContentType } from "../../generated/prisma/client";

// Get all content available for the authenticated user
export async function getAllContentController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const userId = user?.userId as string;

    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await getUserSubscription(userId);

        if (!subscription) {
            throw new ApiError(
                StatusCodes.FORBIDDEN,
                "User does not have a subscription",
            );
        }

        // Cache subscription data
        await redisClient.setEx(
            cacheKey,
            CACHE_TTL.USER_SUBSCRIPTION,
            JSON.stringify(subscription),
        );
    }

    // Try to get content from cache
    const contentCacheKey = CACHE_KEYS.CONTENT_LIST(subscription.planId);
    const cachedContent = await redisClient.get(contentCacheKey);

    let content;
    if (cachedContent) {
        content = JSON.parse(cachedContent);
    } else {
        content = await getAvailableContentForUser(subscription.planId);

        // Cache the result
        await redisClient.setEx(
            contentCacheKey,
            CACHE_TTL.CONTENT,
            JSON.stringify(content),
        );
    }

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            count: content.length,
            content,
        }),
    );
}

// Get a single content by ID with access control
export async function getContentByIdController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { contentId } = req.params;
    const userId = user?.userId as string;

    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await getUserSubscription(userId);

        if (!subscription) {
            throw new ApiError(
                StatusCodes.FORBIDDEN,
                "User does not have a subscription",
            );
        }

        // Cache subscription data
        await redisClient.setEx(
            cacheKey,
            CACHE_TTL.USER_SUBSCRIPTION,
            JSON.stringify(subscription),
        );
    }

    // Try to get content from cache
    const contentCacheKey = CACHE_KEYS.CONTENT_ITEM(
        contentId as string,
        subscription.planId,
    );
    const cachedContent = await redisClient.get(contentCacheKey);

    let content;
    if (cachedContent) {
        content = JSON.parse(cachedContent);
    } else {
        content = await getContentForUser(
            contentId as string,
            subscription.planId,
        );

        if (!content) {
            throw new ApiError(StatusCodes.NOT_FOUND, "Content not found");
        }

        if (!content.hasAccess) {
            throw new ApiError(
                StatusCodes.FORBIDDEN,
                `This content is not available for your ${subscription.plan.type} plan. Please upgrade your subscription.`,
            );
        }

        if (!content.isActive) {
            throw new ApiError(
                StatusCodes.NOT_FOUND,
                "Content is not available",
            );
        }

        // Remove extra fields before caching
        const { hasAccess, isActive, ...cacheData } = content;

        // Cache the result
        await redisClient.setEx(
            contentCacheKey,
            CACHE_TTL.CONTENT,
            JSON.stringify(cacheData),
        );

        content = cacheData;
    }

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            content,
        }),
    );
}

// Get content by type
export async function getContentByTypeController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { contentType } = req.params;
    const userId = user?.userId as string;

    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await getUserSubscription(userId);

        if (!subscription) {
            throw new ApiError(
                StatusCodes.FORBIDDEN,
                "User does not have a subscription",
            );
        }

        // Cache subscription data
        await redisClient.setEx(
            cacheKey,
            CACHE_TTL.USER_SUBSCRIPTION,
            JSON.stringify(subscription),
        );
    }

    // Try to get content from cache
    const contentCacheKey = CACHE_KEYS.CONTENT_BY_TYPE(
        subscription.planId,
        contentType as string,
    );
    const cachedContent = await redisClient.get(contentCacheKey);

    let content;
    if (cachedContent) {
        content = JSON.parse(cachedContent);
    } else {
        content = await getContentByTypeForUser(
            subscription.planId,
            contentType as ContentType,
        );

        // Cache the result
        await redisClient.setEx(
            contentCacheKey,
            CACHE_TTL.CONTENT,
            JSON.stringify(content),
        );
    }

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            count: content.length,
            content,
        }),
    );
}

// Get content by genre
export async function getContentByGenreController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { genre } = req.params;
    const userId = user?.userId as string;

    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await getUserSubscription(userId);

        if (!subscription) {
            throw new ApiError(
                StatusCodes.FORBIDDEN,
                "User does not have a subscription",
            );
        }

        // Cache subscription data
        await redisClient.setEx(
            cacheKey,
            CACHE_TTL.USER_SUBSCRIPTION,
            JSON.stringify(subscription),
        );
    }

    // Try to get content from cache
    const contentCacheKey = CACHE_KEYS.CONTENT_BY_GENRE(
        subscription.planId,
        genre as string,
    );
    const cachedContent = await redisClient.get(contentCacheKey);

    let content;
    if (cachedContent) {
        content = JSON.parse(cachedContent);
    } else {
        content = await getContentByGenreForUser(
            subscription.planId,
            genre as string,
        );

        // Cache the result
        await redisClient.setEx(
            contentCacheKey,
            CACHE_TTL.CONTENT,
            JSON.stringify(content),
        );
    }

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            count: content.length,
            content,
        }),
    );
}

// Get watch history
export async function getWatchHistoryController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const userId = user?.userId as string;

    const history = await getWatchHistory(userId);

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Watch history retrieved", {
            count: history.length,
            history,
        }),
    );
}

// Update watch progress
export async function updateWatchProgressController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { contentId } = req.params;
    const { progress, completed } = req.body;
    const userId = user?.userId as string;

    // Validate input
    if (progress === undefined || progress < 0) {
        throw new ApiError(
            StatusCodes.BAD_REQUEST,
            "Progress must be a non-negative number",
        );
    }

    // Check if user can access this content first
    const canAccess = await canUserAccessContent(userId, contentId as string);
    if (!canAccess) {
        throw new ApiError(
            StatusCodes.FORBIDDEN,
            "You don't have access to this content",
        );
    }

    const result = await updateWatchProgress(
        userId,
        contentId as string,
        progress,
        completed,
    );

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Watch progress updated", {
            contentId: result.contentId,
            progress: result.progress,
            completed: result.completed,
        }),
    );
}

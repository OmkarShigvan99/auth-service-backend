import { prisma } from "../configs/prisma.config";
import { ApiError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import { redisClient, CACHE_KEYS, CACHE_TTL } from "../configs/redis.config";

// Get all content available for a user based on their subscription plan
export async function getAvailableContentForUser(userId: string) {
    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: {
                plan: true,
            },
        });

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

    // Try to get content from cache (cache-aside pattern)
    const contentCacheKey = CACHE_KEYS.CONTENT_LIST(subscription.planId);
    const cachedContent = await redisClient.get(contentCacheKey);

    if (cachedContent) {
        return JSON.parse(cachedContent);
    }

    // Cache miss - fetch from database
    const availableContent = await prisma.content.findMany({
        where: {
            isActive: true,
            access: {
                some: {
                    planId: subscription.planId,
                },
            },
        },
        include: {
            genres: {
                include: {
                    genre: true,
                },
            },
            access: {
                where: {
                    planId: subscription.planId,
                },
            },
        },
        orderBy: {
            releaseDate: "desc",
        },
    });

    const result = availableContent.map((content) => ({
        id: content.id,
        title: content.title,
        description: content.description,
        poster: content.poster,
        thumbnail: content.thumbnail,
        duration: content.duration,
        releaseDate: content.releaseDate,
        rating: content.rating,
        contentType: content.contentType,
        genres: content.genres.map((g) => g.genre.name),
        videoQuality: content.access[0]?.videoQuality || null,
    }));

    // Cache the result with 1 day TTL
    await redisClient.setEx(
        contentCacheKey,
        CACHE_TTL.CONTENT,
        JSON.stringify(result),
    );

    return result;
}

// Get a single content with access control check
export async function getContentForUser(userId: string, contentId: string) {
    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: {
                plan: true,
            },
        });

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
        contentId,
        subscription.planId,
    );
    const cachedContent = await redisClient.get(contentCacheKey);

    if (cachedContent) {
        return JSON.parse(cachedContent);
    }

    // Cache miss - fetch from database
    const content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
            genres: {
                include: {
                    genre: true,
                },
            },
            access: {
                where: {
                    planId: subscription.planId,
                },
            },
        },
    });

    if (!content) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Content not found");
    }

    // Check if user's plan has access to this content
    if (content.access.length === 0) {
        throw new ApiError(
            StatusCodes.FORBIDDEN,
            `This content is not available for your ${subscription.plan.type} plan. Please upgrade your subscription.`,
        );
    }

    if (!content.isActive) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Content is not available");
    }

    const result = {
        id: content.id,
        title: content.title,
        description: content.description,
        poster: content.poster,
        thumbnail: content.thumbnail,
        duration: content.duration,
        releaseDate: content.releaseDate,
        rating: content.rating,
        contentType: content.contentType,
        genres: content.genres.map((g) => g.genre.name),
        videoQuality: content.access[0]?.videoQuality,
    };

    // Cache the result with 1 day TTL
    await redisClient.setEx(
        contentCacheKey,
        CACHE_TTL.CONTENT,
        JSON.stringify(result),
    );

    return result;
}

// Get content by type for a user
export async function getContentByTypeForUser(
    userId: string,
    contentType: string,
) {
    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: {
                plan: true,
            },
        });

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
        contentType,
    );
    const cachedContent = await redisClient.get(contentCacheKey);

    if (cachedContent) {
        return JSON.parse(cachedContent);
    }

    // Cache miss - fetch from database
    const content = await prisma.content.findMany({
        where: {
            contentType: contentType as any,
            isActive: true,
            access: {
                some: {
                    planId: subscription.planId,
                },
            },
        },
        include: {
            genres: {
                include: {
                    genre: true,
                },
            },
            access: {
                where: {
                    planId: subscription.planId,
                },
            },
        },
        orderBy: {
            releaseDate: "desc",
        },
    });

    const result = content.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        poster: c.poster,
        thumbnail: c.thumbnail,
        duration: c.duration,
        releaseDate: c.releaseDate,
        rating: c.rating,
        contentType: c.contentType,
        genres: c.genres.map((g) => g.genre.name),
        videoQuality: c.access[0]?.videoQuality,
    }));

    // Cache the result with 1 day TTL
    await redisClient.setEx(
        contentCacheKey,
        CACHE_TTL.CONTENT,
        JSON.stringify(result),
    );

    return result;
}

// Get content by genre for a user
export async function getContentByGenreForUser(
    userId: string,
    genreName: string,
) {
    // Get user's subscription (with caching)
    const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION(userId);
    let subscription;

    const cachedSubscription = await redisClient.get(cacheKey);
    if (cachedSubscription) {
        subscription = JSON.parse(cachedSubscription);
    } else {
        subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: {
                plan: true,
            },
        });

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
        genreName,
    );
    const cachedContent = await redisClient.get(contentCacheKey);

    if (cachedContent) {
        return JSON.parse(cachedContent);
    }

    // Cache miss - fetch from database
    const content = await prisma.content.findMany({
        where: {
            isActive: true,
            genres: {
                some: {
                    genre: {
                        name: genreName,
                    },
                },
            },
            access: {
                some: {
                    planId: subscription.planId,
                },
            },
        },
        include: {
            genres: {
                include: {
                    genre: true,
                },
            },
            access: {
                where: {
                    planId: subscription.planId,
                },
            },
        },
        orderBy: {
            releaseDate: "desc",
        },
    });

    const result = content.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        poster: c.poster,
        thumbnail: c.thumbnail,
        duration: c.duration,
        releaseDate: c.releaseDate,
        rating: c.rating,
        contentType: c.contentType,
        genres: c.genres.map((g) => g.genre.name),
        videoQuality: c.access[0]?.videoQuality,
    }));

    // Cache the result with 1 day TTL
    await redisClient.setEx(
        contentCacheKey,
        CACHE_TTL.CONTENT,
        JSON.stringify(result),
    );

    return result;
}

// Check if user can access specific content (for streaming/playback)
export async function canUserAccessContent(
    userId: string,
    contentId: string,
): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
    });

    if (!subscription) {
        return false;
    }

    const access = await prisma.contentAccess.findUnique({
        where: {
            contentId_planId: {
                contentId,
                planId: subscription.planId,
            },
        },
    });

    return !!access;
}

// Get watch history for a user
export async function getWatchHistory(userId: string) {
    const watchHistory = await prisma.watchHistory.findMany({
        where: { userId },
        include: {
            content: {
                include: {
                    genres: {
                        include: {
                            genre: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            watchedAt: "desc",
        },
    });

    return watchHistory.map((history) => ({
        id: history.id,
        contentId: history.contentId,
        title: history.content.title,
        progress: history.progress,
        completed: history.completed,
        watchedAt: history.watchedAt,
        genres: history.content.genres.map((g) => g.genre.name),
    }));
}

// Update watch history (track viewing progress)
export async function updateWatchProgress(
    userId: string,
    contentId: string,
    progress: number,
    completed: boolean = false,
) {
    return await prisma.watchHistory.upsert({
        where: {
            userId_contentId: {
                userId,
                contentId,
            },
        },
        update: {
            progress,
            completed,
            watchedAt: new Date(),
        },
        create: {
            userId,
            contentId,
            progress,
            completed,
        },
    });
}

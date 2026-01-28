import { prisma } from "../configs/prisma.config";
import { ApiError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";

// Get all content available for a user based on their subscription plan
export async function getAvailableContentForUser(userId: string) {
    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
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

    // Get all content accessible to this plan
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

    return availableContent.map((content) => ({
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
}

// Get a single content with access control check
export async function getContentForUser(userId: string, contentId: string) {
    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
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

    // Check if content exists
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

    return {
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
}

// Get content by type for a user
export async function getContentByTypeForUser(
    userId: string,
    contentType: string,
) {
    const subscription = await prisma.subscription.findUnique({
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

    return content.map((c) => ({
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
}

// Get content by genre for a user
export async function getContentByGenreForUser(
    userId: string,
    genreName: string,
) {
    const subscription = await prisma.subscription.findUnique({
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

    return content.map((c) => ({
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

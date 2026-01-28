import { prisma } from "../configs/prisma.config";

// Get user's subscription
export async function getUserSubscription(userId: string) {
    return await prisma.subscription.findUnique({
        where: { userId },
        include: {
            plan: true,
        },
    });
}

// Get all content available for a user based on their subscription plan
export async function getAvailableContentForUser(planId: number) {
    const availableContent = await prisma.content.findMany({
        where: {
            isActive: true,
            access: {
                some: {
                    planId: planId,
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
                    planId: planId,
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

// Get a single content with access check
export async function getContentForUser(contentId: string, planId: number) {
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
                    planId: planId,
                },
            },
        },
    });

    if (!content) {
        return null;
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
        isActive: content.isActive,
        hasAccess: content.access.length > 0,
    };
}

// Get content by type for a user
export async function getContentByTypeForUser(
    planId: number,
    contentType: string,
) {
    const content = await prisma.content.findMany({
        where: {
            contentType: contentType as any,
            isActive: true,
            access: {
                some: {
                    planId: planId,
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
                    planId: planId,
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
    planId: number,
    genreName: string,
) {
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
                    planId: planId,
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
                    planId: planId,
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

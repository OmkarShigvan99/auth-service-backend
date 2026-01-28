import { prisma } from "../configs/prisma.config";

interface CreateSessionInput {
    userId: string;
    deviceId: string;
    deviceName: string | null;
    refreshTokenHash: string;
    expiresAt: Date;
    lastUsedAt?: Date | null;
}

export async function createSession(input: CreateSessionInput) {
    const { userId, deviceId, deviceName, refreshTokenHash, expiresAt } = input;

    const session = await prisma.session.create({
        data: {
            userId,
            deviceId,
            deviceName,
            refreshTokenHash,
            expiresAt,
            lastUsedAt: input.lastUsedAt || null,
        },
        select: {
            id: true,
            userId: true,
            deviceId: true,
            deviceName: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
        },
    });

    return session;
}

export async function invalidateSession(sessionId: string): Promise<void> {
    await prisma.session.update({
        where: { id: sessionId },
        data: {
            isRevoked: true,
        },
    });
}

export async function getSession(sessionId: string) {
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            userId: true,
            deviceId: true,
            deviceName: true,
            createdAt: true,
            lastUsedAt: true,
            isRevoked: true,
            refreshTokenHash: true,
            expiresAt: true,
        },
    });

    return session;
}

export async function getSessionByUserIdAndDeviceId(
    userId: string,
    deviceId: string,
) {
    const session = await prisma.session.findUnique({
        where: {
            userId_deviceId: {
                userId,
                deviceId,
            },
        },
        select: {
            id: true,
            userId: true,
            deviceId: true,
            deviceName: true,
            createdAt: true,
            lastUsedAt: true,
            isRevoked: true,
            refreshTokenHash: true,
        },
    });

    return session;
}

export async function getActiveSessionsByUser(userId: string) {
    const sessions = await prisma.session.findMany({
        where: {
            userId,
            isRevoked: false,
        },
        select: {
            id: true,
            userId: true,
            deviceId: true,
            deviceName: true,
            createdAt: true,
            lastUsedAt: true,
        },
    });

    return sessions;
}

export async function revokeLeastRecentSession(userId: string): Promise<void> {
    const leastRecentSession = await prisma.session.findFirst({
        where: {
            userId,
            isRevoked: false,
        },
        orderBy: {
            createdAt: "asc",
        },
    });

    if (leastRecentSession) {
        await invalidateSession(leastRecentSession.id);
    }
}

export async function revokeAllSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
        where: {
            userId,
            isRevoked: false,
        },
        data: {
            isRevoked: true,
        },
    });
}

export async function updateSessionLastUsedAt(
    sessionId: string,
): Promise<void> {
    await prisma.session.update({
        where: { id: sessionId },
        data: {
            lastUsedAt: new Date(),
        },
    });
}

export async function updateSessionRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
): Promise<void> {
    await prisma.session.update({
        where: { id: sessionId },
        data: {
            refreshTokenHash,
        },
    });
}

export async function deleteSession(sessionId: string): Promise<void> {
    await prisma.session.delete({
        where: { id: sessionId },
    });
}

export async function getSessionByRefreshTokenHash(refreshTokenHash: string) {
    const session = await prisma.session.findFirst({
        where: { refreshTokenHash },
        select: {
            id: true,
            userId: true,
            deviceId: true,
            deviceName: true,
            createdAt: true,
            lastUsedAt: true,
            refreshTokenHash: true,
            isRevoked: true,
        },
    });
    return session;
}

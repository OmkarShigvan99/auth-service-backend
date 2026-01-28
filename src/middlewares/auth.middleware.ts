import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { getUser } from "../services/user.service";
import {
    getSession,
    getSessionByUserIdAndDeviceId,
    updateSessionLastUsedAt,
} from "../services/session.service";
import { redisClient, CACHE_KEYS, CACHE_TTL } from "../configs/redis.config";
import { ca } from "zod/locales";

// JWT payload type
type JwtPayload = {
    userId: string;
    sessionId: string;
    deviceId: string;
};

// Extended Request interface to include user info
export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}

// Extract token from Authorization header
function extractToken(authHeader?: string): string {
    if (!authHeader) {
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Access token is required",
        );
    }

    if (!authHeader.startsWith("Bearer ")) {
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Invalid authorization header format. Expected: Bearer <token>",
        );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Access token is required",
        );
    }

    return token;
}

// Handle token verification errors
function handleTokenError(error: any): never {
    const message = error?.message || "";

    console.log(message);

    if (message.includes("expired")) {
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Token has expired. Please login again.",
        );
    }

    if (
        message.includes("invalid") ||
        message.includes("verify") ||
        message.includes("malformed")
    ) {
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Invalid or malformed token",
        );
    }

    throw new Error("Something went wrong during token verification");
}

// Authentication middleware
export const authMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    try {
        const accessToken = extractToken(req.headers.authorization);
        let payload: JwtPayload;
        try {
            // Verify token
            payload = jwt.verify(
                accessToken,
                process.env.JWT_ACCESS_TOKEN_SECRET as string,
            ) as JwtPayload;
        } catch (error) {
            handleTokenError(error);
        }

        const { userId, sessionId, deviceId } = payload;

        // Step 1: Try to get session from Redis cache (cache-aside pattern)
        const cacheKey = CACHE_KEYS.SESSION(sessionId);
        const cachedSession = await redisClient.get(cacheKey);

        let session;
        if (cachedSession) {
            // Cache hit
            session = JSON.parse(cachedSession);
        } else {
            // Cache miss - fetch from database
            // Check if user exists using user service
            const user = await getUser(userId);
            if (!user) {
                throw new ApiError(
                    StatusCodes.UNAUTHORIZED,
                    "User not found. Token is invalid.",
                );
            }

            // Check if session exists using session service
            session = await getSession(sessionId);
            if (!session) {
                throw new ApiError(
                    StatusCodes.UNAUTHORIZED,
                    "Session not found. Please login again.",
                );
            }

            // Cache the session in Redis with TTL
            await redisClient.setEx(
                cacheKey,
                CACHE_TTL.SESSION,
                JSON.stringify(session),
            );
        }

        // Check if session is revoked
        if (session.isRevoked) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session has been revoked. Please login again.",
            );
        }

        // Check if session has expired
        if (new Date() > new Date(session.expiresAt)) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session has expired. Please login again.",
            );
        }

        // Verify session ID matches (additional security check)
        if (session.id !== sessionId) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session ID mismatch. Token is invalid.",
            );
        }

        // Update session lastUsedAt (session is valid and being used)
        await updateSessionLastUsedAt(sessionId);

        // All checks passed, set user info
        req.user = {
            userId,
            sessionId,
            deviceId,
        };

        next();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        handleTokenError(error);
    }
};

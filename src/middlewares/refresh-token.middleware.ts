import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/errorHandler";
import { StatusCodes } from "http-status-codes";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
    getSession,
} from "../services/session.service";

// Refresh token payload type
export type RefreshTokenPayload = {
    userId: string;
    deviceId: string;
};

// Extended Request interface to include refresh token info
export interface RefreshTokenRequest extends Request {
    refreshTokenData?: RefreshTokenPayload & {
        sessionId: string;
        refreshToken: string;
    };
    cookies: any;
}

// Middleware to verify and validate refresh token
export const verifyRefreshTokenMiddleware = async (
    req: RefreshTokenRequest,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const { deviceType, accessToken } = req.body;

        // Validate device type is provided
        if (!deviceType) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                "Device type is required",
            );
        }

        // Validate access token is provided
        if (!accessToken) {
            throw new ApiError(
                StatusCodes.BAD_REQUEST,
                "Access token is required",
            );
        }

        // Extract sessionId from access token
        let sessionId: string;
        try {
            const accessTokenPayload = jwt.verify(
                accessToken,
                process.env.JWT_ACCESS_TOKEN_SECRET as string,
                { ignoreExpiration: true }, // Ignore expiry, only extract payload
            ) as any;
            sessionId = accessTokenPayload.sessionId;

            if (!sessionId) {
                throw new ApiError(
                    StatusCodes.UNAUTHORIZED,
                    "Invalid access token: missing session ID",
                );
            }
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Invalid access token",
            );
        }

        // Get refresh token based on device type
        let refreshToken: string;

        if (deviceType === "WEB") {
            // For WEB: Get from httpOnly cookie
            refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                throw new ApiError(
                    StatusCodes.BAD_REQUEST,
                    "Refresh token cookie is required",
                );
            }
        } else if (deviceType === "ANDROID" || deviceType === "IOS") {
            // For ANDROID/IOS: Get from request body
            refreshToken = req.body.refreshToken;
            if (!refreshToken) {
                throw new ApiError(
                    StatusCodes.BAD_REQUEST,
                    "Refresh token is required",
                );
            }
        } else {
            throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid device type");
        }

        // Validate token format (should be 64 characters hex string from randomBytes(32))
        if (
            !refreshToken ||
            typeof refreshToken !== "string" ||
            refreshToken.length !== 64
        ) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Invalid refresh token format",
            );
        }

        // Get session by sessionId extracted from access token
        const session = await getSession(sessionId);

        if (!session) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session not found. Please login again.",
            );
        }

        if (session.isRevoked) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session has been revoked. Please login again.",
            );
        }

        // Check if session has expired
        if (new Date() > session.expiresAt) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session has expired. Please login again.",
            );
        }

        // Validate refreshTokenHash exists and is not empty
        if (!session.refreshTokenHash) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Session token hash is corrupted. Please login again.",
            );
        }

        // Validate hash format (should start with $2b$ for bcrypt)
        if (!session.refreshTokenHash.startsWith("$2b$")) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Invalid session token format. Please login again.",
            );
        }

        // Verify refresh token matches session hash
        const isRefreshTokenValid = await bcrypt.compare(
            refreshToken,
            session.refreshTokenHash,
        );

        if (!isRefreshTokenValid) {
            throw new ApiError(
                StatusCodes.UNAUTHORIZED,
                "Invalid refresh token. Please login again.",
            );
        }

        // All validations passed, attach data to request
        req.refreshTokenData = {
            sessionId: session.id,
            userId: session.userId,
            deviceId: session.deviceId,
            refreshToken,
        };

        next();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "Refresh token validation failed",
        );
    }
};

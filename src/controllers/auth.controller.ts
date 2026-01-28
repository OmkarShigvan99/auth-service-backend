import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import { prisma } from "../configs/prisma.config";
import { createUser } from "../services/user.service";
import {
    createSession,
    getActiveSessionsByUser,
    invalidateSession,
    revokeAllSessions,
    revokeLeastRecentSession,
    getSession,
    updateSessionRefreshToken,
    getSessionByRefreshTokenHash,
    getSessionByUserIdAndDeviceId,
    deleteSession,
} from "../services/session.service";
import { RegisterInput, LoginInput } from "../validation-schemas/auth.schema";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../utils/errorHandler";
import { ApiResponse } from "../utils/ApiResponse";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import {
    getSubscriptionByUser,
    createSubscription,
} from "../services/subscription.service";
import { PlanType } from "../../generated/prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { getPlanByType } from "../services/plan.service";
import {
    RefreshTokenPayload,
    RefreshTokenRequest,
} from "../middlewares/refresh-token.middleware";
import {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
} from "../constants/auth.constant";

export async function registerController(
    req: Request<{}, {}, RegisterInput>,
    res: Response,
): Promise<void> {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new ApiError(
            StatusCodes.CONFLICT,
            "User with this email already exists",
        );
    }

    // Get FREE plan
    const plan = await getPlanByType(PlanType.FREE);

    if (!plan) {
        throw new ApiError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Default plan not found. Please contact support.",
        );
    }

    prisma.$transaction(async () => {
        // Create user
        const user = await createUser({ email, password });

        // Create subscription with FREE plan
        await createSubscription({
            userId: user.id,
            planId: plan.id,
        });

        res.status(StatusCodes.CREATED).json(
            new ApiResponse(
                StatusCodes.CREATED,
                "User registered successfully",
                {
                    id: user.id,
                    email: user.email,
                },
            ),
        );
    });
}

export async function loginController(
    req: Request<{}, {}, LoginInput>,
    res: Response,
): Promise<void> {
    const {
        email,
        password,
        deviceId,
        deviceName = null,
        logoutStrategy,
        deviceType,
    } = req.body;

    //Find user by email
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            "No user found with this email",
        );
    }

    const alreadyHasSession = await getSessionByUserIdAndDeviceId(
        user.id,
        deviceId,
    );
    if (alreadyHasSession && !alreadyHasSession.isRevoked) {
        await deleteSession(alreadyHasSession.id);
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid password");
    }

    // Get subscription and check device limit
    const subscription = await getSubscriptionByUser(user.id);
    if (!subscription) {
        throw new ApiError(
            StatusCodes.FORBIDDEN,
            "No subscription found for this user",
        );
    }

    // Check active sessions and device limit
    const plan = subscription.plan;
    const activeSessions = await getActiveSessionsByUser(user.id);

    if (activeSessions.length >= plan.maxDevices) {
        // Device limit reached - handle logout strategy
        if (!logoutStrategy) {
            // No strategy provided - return error with options
            throw new ApiError(
                StatusCodes.FORBIDDEN,
                `Device limit reached for your plan (${plan.type}). Please logout from other devices or upgrade your plan.`,
                false,
                {
                    error: "DEVICE_LIMIT_REACHED",
                    options: ["LOGOUT_ALL", "LOGOUT_LEAST_RECENT"],
                    activeSessions: activeSessions.map((session) => ({
                        deviceName: session.deviceName ?? "Unnamed Device",
                        lastUsedAt: session.lastUsedAt,
                    })),
                },
            );
        }

        // Apply logout strategy to make room for new login
        if (logoutStrategy === "LOGOUT_LEAST_RECENT") {
            await revokeLeastRecentSession(user.id);
        } else if (logoutStrategy === "LOGOUT_ALL") {
            await revokeAllSessions(user.id);
        }
    }

    // Create tokens
    const refreshToken = randomBytes(32).toString("hex");

    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const session = await createSession({
        userId: user.id,
        deviceId,
        deviceName,
        refreshTokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt,
        lastUsedAt: new Date(),
    });

    // Create access token
    const accessToken = jwt.sign(
        { userId: user.id, deviceId, sessionId: session.id },
        process.env.JWT_ACCESS_TOKEN_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );

    // Prepare response data
    const responseData: any = {
        user: {
            id: user.id,
            email: user.email,
        },
        session: {
            id: session.id,
            deviceId: session.deviceId,
            accessToken,
            expiresIn: 900, // 15 minutes in seconds
        },
    };

    // Handle token storage based on device type
    if (deviceType === "WEB") {
        // For WEB: Use httpOnly cookie for refresh token, return only access token
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            path: "/api/auth/refresh",
        });
    } else if (deviceType === "ANDROID" || deviceType === "IOS") {
        // For ANDROID/IOS: Return refresh token in response (stored in app secure storage)
        responseData.session.refreshToken = refreshToken;
    }

    // Send response
    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Login successful", responseData),
    );
}

export async function logoutController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    await invalidateSession(user?.sessionId as string);

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Logout successful", null),
    );
}

export async function logoutAllController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const activeSessions = await getActiveSessionsByUser(
        user?.userId as string,
    );

    for (const session of activeSessions) {
        await invalidateSession(session.id);
    }
    res.status(StatusCodes.OK).json(
        new ApiResponse(
            StatusCodes.OK,
            "All sessions logged out successfully",
            null,
        ),
    );
}

export async function refreshAccessTokenController(
    req: Request,
    res: Response,
): Promise<void> {
    const refreshReq = req as RefreshTokenRequest;
    const { sessionId, userId, deviceId } =
        refreshReq.refreshTokenData as RefreshTokenPayload & {
            sessionId: string;
            refreshToken: string;
        };
    const { deviceType } = req.body;

    // Generate new access token
    const newAccessToken = jwt.sign(
        { userId, deviceId, sessionId },
        process.env.JWT_ACCESS_TOKEN_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );

    // Rotate refresh token (generate new one and update session)
    const newRefreshToken = randomBytes(32).toString("hex");
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    await updateSessionRefreshToken(sessionId, newRefreshTokenHash);

    // Prepare response data
    const responseData: any = {
        accessToken: newAccessToken,
        expiresIn: 900, // 15 minutes in seconds
    };

    // Handle token storage based on device type
    if (deviceType === "WEB") {
        // For WEB: Use httpOnly cookie for refresh token
        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            path: "/api/auth/refresh",
        });
    } else if (deviceType === "ANDROID" || deviceType === "IOS") {
        // For ANDROID/IOS: Return refresh token in response
        responseData.refreshToken = newRefreshToken;
    }

    // Return response
    res.status(StatusCodes.OK).json(
        new ApiResponse(
            StatusCodes.OK,
            "Token refreshed successfully",
            responseData,
        ),
    );
}

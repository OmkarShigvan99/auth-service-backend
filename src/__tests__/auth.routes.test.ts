import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app";
import * as userService from "../services/user.service";
import * as sessionService from "../services/session.service";
import * as subscriptionService from "../services/subscription.service";
import * as planService from "../services/plan.service";
import { prisma } from "../configs/prisma.config";
import { redisClient } from "../configs/redis.config";
import jwt from "jsonwebtoken";
import { PlanType } from "../../generated/prisma/client";

// Mock bcrypt module
vi.mock("bcrypt", () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn(),
    },
    compare: vi.fn(),
    hash: vi.fn(),
}));

// Import bcrypt after mocking
import * as bcrypt from "bcrypt";

// Mock all external dependencies
vi.mock("../configs/prisma.config", () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        session: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        subscription: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        plan: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback()),
    },
}));

// Mock rate limiters to disable rate limiting in tests
vi.mock("../middlewares/limiters.middleware", () => ({
    globalLimiter: (req: any, res: any, next: any) => next(),
    authLimiter: (req: any, res: any, next: any) => next(),
    contentLimiter: (req: any, res: any, next: any) => next(),
}));

vi.mock("../configs/redis.config", () => ({
    redisClient: {
        get: vi.fn(),
        setEx: vi.fn(),
        del: vi.fn(),
    },
    CACHE_KEYS: {
        SESSION: (sessionId: string) => `session:${sessionId}`,
        USER_SUBSCRIPTION: (userId: string) => `user:subscription:${userId}`,
    },
    CACHE_TTL: {
        SESSION: 900,
        USER_SUBSCRIPTION: 900,
    },
}));

// Helper function to generate valid tokens
const generateAccessToken = (
    userId: string,
    sessionId: string,
    deviceId: string,
) => {
    return jwt.sign(
        { userId, sessionId, deviceId },
        process.env.JWT_ACCESS_TOKEN_SECRET || "test-access-secret",
        { expiresIn: "15m" },
    );
};

const generateRefreshToken = () => {
    return Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
    ).join("");
};

describe("Auth Routes", () => {
    const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
        createdAt: new Date(),
    };

    const mockPlan = {
        id: 1,
        type: PlanType.FREE,
        maxDevices: 1,
    };

    const mockSession = {
        id: "session-123",
        userId: "user-123",
        deviceId: "device-123",
        deviceName: "Test Device",
        refreshTokenHash: "$2b$10$hash",
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        lastUsedAt: new Date(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Set up default environment variables
        process.env.JWT_ACCESS_TOKEN_SECRET = "test-access-secret";
        process.env.JWT_REFRESH_TOKEN_SECRET = "test-refresh-secret";
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("POST /api/auth/register", () => {
        it("should register a new user successfully", async () => {
            // Mock: User doesn't exist
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            // Mock: Plan exists
            vi.spyOn(planService, "getPlanByType").mockResolvedValue(mockPlan);

            // Mock: User creation
            vi.spyOn(userService, "createUser").mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                createdAt: mockUser.createdAt,
            });

            // Mock: Subscription creation
            vi.spyOn(
                subscriptionService,
                "createSubscription",
            ).mockResolvedValue({
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
            } as any);

            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: "newuser@example.com",
                    password: "Password123!",
                });

            expect(response.status).toBe(201);
            expect(response.body.message).toBe("User registered successfully");
            expect(response.body.data).toHaveProperty("id");
            expect(response.body.data).toHaveProperty("email");
        });

        it("should return 409 if user already exists", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );

            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: mockUser.email,
                    password: "Password123!",
                });

            expect(response.status).toBe(409);
            expect(response.body.message).toContain("already exists");
        });

        it("should return 400 for invalid email format", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: "invalid-email",
                    password: "Password123!",
                });

            expect(response.status).toBe(400);
        });

        it("should return 400 for weak password (no uppercase)", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: "test@example.com",
                    password: "password123!",
                });

            expect(response.status).toBe(400);
        });

        it("should return 400 for weak password (no special character)", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: "test@example.com",
                    password: "Password123",
                });

            expect(response.status).toBe(400);
        });

        it("should return 400 for weak password (too short)", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: "test@example.com",
                    password: "Pass1!",
                });

            expect(response.status).toBe(400);
        });

        it("should return 500 if plan is not found", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
            vi.spyOn(planService, "getPlanByType").mockResolvedValue(null);

            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: "test@example.com",
                    password: "Password123!",
                });

            expect(response.status).toBe(500);
        });
    });

    describe("POST /api/auth/login", () => {
        beforeEach(() => {
            // Mock Redis cache miss
            vi.mocked(redisClient.get).mockResolvedValue(null);
            vi.mocked(redisClient.setEx).mockResolvedValue("OK");
        });

        it("should login successfully for WEB device", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan,
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([]);
            vi.spyOn(sessionService, "createSession").mockResolvedValue(
                mockSession as any,
            );

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "1bbbf2ce-3573-4403-a8d4-6d3d6c79d4d9",
                deviceType: "WEB",
                deviceName: "Chrome Browser",
            });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Login successful");
            expect(response.body.data.session).toHaveProperty("accessToken");
            expect(response.body.data.session).not.toHaveProperty(
                "refreshToken",
            ); // WEB uses cookie
            expect(response.headers["set-cookie"]).toBeDefined(); // Cookie should be set
        });

        it("should login successfully for ANDROID device with refresh token in response", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan,
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([]);
            vi.spyOn(sessionService, "createSession").mockResolvedValue(
                mockSession as any,
            );

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "2bbbf2ce-3573-4403-a8d4-6d3d6c79d4d9",
                deviceType: "ANDROID",
                deviceName: "Samsung Phone",
            });

            expect(response.status).toBe(200);
            expect(response.body.data.session).toHaveProperty("refreshToken"); // Mobile gets token in response
        });

        it("should return 401 for incorrect email", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            const response = await request(app).post("/api/auth/login").send({
                email: "wrong@example.com",
                password: "Password123!",
                deviceId: "1bbbf2ce-3573-4403-a8d4-6d3d6c79d4d9",
                deviceType: "WEB",
            });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("No user found");
        });

        it("should return 401 for incorrect password", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "WrongPassword123!",
                deviceId: "1bbbf2ce-3573-4403-a8d4-6d3d6c79d4d9",
                deviceType: "WEB",
            });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("Invalid password");
        });

        it("should return 403 when device limit reached without logout strategy", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan, // FREE plan with maxDevices: 1
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);

            // Mock: Already 1 active session (limit reached)
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([mockSession as any]);

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "54f2f69a-6be6-45a2-aa2e-561f9bcb96a3", // Different device
                deviceType: "WEB",
            });

            expect(response.status).toBe(403);
            expect(response.body.message).toContain("Device limit reached");
            expect(response.body.data.error).toBe("DEVICE_LIMIT_REACHED");
            expect(response.body.data.options).toContain("LOGOUT_ALL");
            expect(response.body.data.options).toContain("LOGOUT_LEAST_RECENT");
        });

        it("should logout least recent session when device limit reached with LOGOUT_LEAST_RECENT strategy", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan,
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([mockSession as any]);

            const revokeSpy = vi
                .spyOn(sessionService, "revokeLeastRecentSession")
                .mockResolvedValue();
            vi.spyOn(sessionService, "createSession").mockResolvedValue({
                ...mockSession,
                id: "session-new",
            } as any);

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "54f2f69a-6be6-45a2-aa2e-561f9bcb96a3",
                deviceType: "WEB",
                logoutStrategy: "LOGOUT_LEAST_RECENT",
            });

            expect(response.status).toBe(200);
            expect(revokeSpy).toHaveBeenCalledWith(mockUser.id);
        });

        it("should logout all sessions when device limit reached with LOGOUT_ALL strategy", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan,
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([
                mockSession as any,
                { ...mockSession, id: "session-2" } as any,
            ]);

            const revokeAllSpy = vi
                .spyOn(sessionService, "revokeAllSessions")
                .mockResolvedValue();
            vi.spyOn(sessionService, "createSession").mockResolvedValue(
                mockSession as any,
            );

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "54f2f69a-6be6-45a2-aa2e-561f9bcb96a3",
                deviceType: "WEB",
                logoutStrategy: "LOGOUT_ALL",
            });

            expect(response.status).toBe(200);
            expect(revokeAllSpy).toHaveBeenCalledWith(mockUser.id);
        });

        it("should return 400 for invalid deviceId format", async () => {
            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "invalid-uuid",
                deviceType: "WEB",
            });

            expect(response.status).toBe(400);
        });

        it("should return 400 for invalid deviceType", async () => {
            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "550e8400-e29b-41d4-a716-446655440000",
                deviceType: "INVALID",
            });

            expect(response.status).toBe(400);
        });

        it("should return 403 if user has no subscription", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(null);

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "550e8400-e29b-41d4-a716-446655440000",
                deviceType: "WEB",
            });

            expect(response.status).toBe(403);
        });
    });

    describe("POST /api/auth/refresh", () => {
        const validAccessToken = generateAccessToken(
            mockUser.id,
            mockSession.id,
            mockSession.deviceId,
        );
        const validRefreshToken = generateRefreshToken();

        beforeEach(() => {
            vi.mocked(redisClient.get).mockResolvedValue(null);
            vi.mocked(redisClient.setEx).mockResolvedValue("OK");
        });

        it("should refresh access token successfully for WEB device", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.spyOn(
                sessionService,
                "updateSessionRefreshToken",
            ).mockResolvedValue();

            const response = await request(app)
                .post("/api/auth/refresh")
                .set("Cookie", [`refreshToken=${validRefreshToken}`])
                .send({
                    deviceType: "WEB",
                    accessToken: validAccessToken,
                });

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty("accessToken");
            expect(response.body.data).not.toHaveProperty("refreshToken"); // WEB uses cookie
        });

        it("should refresh access token successfully for ANDROID device", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.spyOn(
                sessionService,
                "updateSessionRefreshToken",
            ).mockResolvedValue();

            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken: validRefreshToken,
            });

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty("accessToken");
            expect(response.body.data).toHaveProperty("refreshToken"); // Mobile gets new token
        });

        it("should return 401 for invalid refresh token", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken:
                    "invalid-token-1234567890123456789012345678901234567890123456789012",
            });

            expect(response.status).toBe(401);
        });

        it("should return 401 for revoked session", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue({
                ...mockSession,
                isRevoked: true,
            } as any);

            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken: validRefreshToken,
            });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("revoked");
        });

        it("should return 401 for expired session", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue({
                ...mockSession,
                expiresAt: new Date(Date.now() - 1000), // Expired
            } as any);

            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken: validRefreshToken,
            });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("expired");
        });

        it("should return 401 for session not found", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue(null);

            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken: validRefreshToken,
            });
            console.log(response.body);
            expect(response.status).toBe(401);
            expect(response.body.message).toContain("not found");
        });

        it("should return 400 if deviceType is missing", async () => {
            const response = await request(app).post("/api/auth/refresh").send({
                accessToken: validAccessToken,
                refreshToken: validRefreshToken,
            });

            expect(response.status).toBe(400);
        });

        it("should return 400 if accessToken is missing", async () => {
            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                refreshToken: validRefreshToken,
            });

            expect(response.status).toBe(400);
        });

        it("should return 400 if refreshToken is missing for mobile", async () => {
            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
            });

            expect(response.status).toBe(400);
        });

        it("should return 401 for invalid refresh token format (not 64 chars)", async () => {
            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken: "short",
            });

            expect(response.status).toBe(401);
        });

        it("should return 401 for expired access token with valid signature", async () => {
            const expiredToken = jwt.sign(
                {
                    userId: mockUser.id,
                    sessionId: mockSession.id,
                    deviceId: mockSession.deviceId,
                },
                process.env.JWT_ACCESS_TOKEN_SECRET!,
                { expiresIn: "-1h" },
            );

            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.spyOn(
                sessionService,
                "updateSessionRefreshToken",
            ).mockResolvedValue();

            const response = await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: expiredToken,
                refreshToken: validRefreshToken,
            });

            // Should still work because we ignore expiration for refresh
            expect(response.status).toBe(200);
        });
    });

    describe("POST /api/auth/logout", () => {
        const validAccessToken = generateAccessToken(
            mockUser.id,
            mockSession.id,
            mockSession.deviceId,
        );

        beforeEach(() => {
            vi.mocked(redisClient.get).mockResolvedValue(null);
            vi.mocked(redisClient.setEx).mockResolvedValue("OK");
            vi.mocked(redisClient.del).mockResolvedValue(1);
        });

        it("should logout successfully and invalidate session", async () => {
            // Mock auth middleware dependencies
            vi.spyOn(userService, "getUser").mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                createdAt: mockUser.createdAt,
            });
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.spyOn(
                sessionService,
                "updateSessionLastUsedAt",
            ).mockResolvedValue();

            const invalidateSpy = vi
                .spyOn(sessionService, "invalidateSession")
                .mockResolvedValue();

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Logout successful");
            expect(invalidateSpy).toHaveBeenCalledWith(mockSession.id);
            expect(redisClient.del).toHaveBeenCalled(); // Session removed from cache
        });

        it("should return 401 without access token", async () => {
            const response = await request(app).post("/api/auth/logout");

            expect(response.status).toBe(401);
        });

        it("should return 401 with invalid access token", async () => {
            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", "Bearer invalid-token");

            expect(response.status).toBe(401);
        });

        it("should return 401 with expired access token", async () => {
            const expiredToken = jwt.sign(
                {
                    userId: mockUser.id,
                    sessionId: mockSession.id,
                    deviceId: mockSession.deviceId,
                },
                process.env.JWT_ACCESS_TOKEN_SECRET!,
                { expiresIn: "-1h" },
            );

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("expired");
        });

        it("should return 401 for non-existent user", async () => {
            vi.spyOn(userService, "getUser").mockResolvedValue(null);

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("User not found");
        });

        it("should return 401 for revoked session", async () => {
            vi.spyOn(userService, "getUser").mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                createdAt: mockUser.createdAt,
            });
            vi.spyOn(sessionService, "getSession").mockResolvedValue({
                ...mockSession,
                isRevoked: true,
            } as any);

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("revoked");
        });

        it("should use cached session from Redis on subsequent requests", async () => {
            const cachedSession = JSON.stringify(mockSession);
            vi.mocked(redisClient.get).mockResolvedValue(cachedSession);

            vi.spyOn(
                sessionService,
                "updateSessionLastUsedAt",
            ).mockResolvedValue();
            vi.spyOn(sessionService, "invalidateSession").mockResolvedValue();
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
            // getSession should NOT be called since we got it from cache
            expect(sessionService.getSession).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/auth/logout-all", () => {
        beforeEach(() => {
            vi.mocked(redisClient.get).mockResolvedValue(null);
            vi.mocked(redisClient.setEx).mockResolvedValue("OK");
            vi.mocked(redisClient.del).mockResolvedValue(1);
        });

        it("should logout from all devices successfully with email and password", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const sessions = [
                mockSession,
                { ...mockSession, id: "session-2" },
                { ...mockSession, id: "session-3" },
            ];
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue(sessions as any);

            const invalidateSpy = vi
                .spyOn(sessionService, "invalidateSession")
                .mockResolvedValue();

            const response = await request(app)
                .post("/api/auth/logout-all")
                .send({
                    email: mockUser.email,
                    password: "Password123!",
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe(
                "All sessions logged out successfully",
            );
            expect(invalidateSpy).toHaveBeenCalledTimes(3);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: mockUser.email },
            });
            expect(bcrypt.compare).toHaveBeenCalledWith(
                "Password123!",
                mockUser.passwordHash,
            );
        });

        it("should return 401 with invalid email", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            const response = await request(app)
                .post("/api/auth/logout-all")
                .send({
                    email: "nonexistent@example.com",
                    password: "Password123!",
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain(
                "Invalid email or password",
            );
        });

        it("should return 401 with invalid password", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            const response = await request(app)
                .post("/api/auth/logout-all")
                .send({
                    email: mockUser.email,
                    password: "WrongPassword123!",
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toContain(
                "Invalid email or password",
            );
        });

        it("should return 400 without email", async () => {
            const response = await request(app)
                .post("/api/auth/logout-all")
                .send({
                    password: "Password123!",
                });

            expect(response.status).toBe(400);
        });

        it("should return 400 without password", async () => {
            const response = await request(app)
                .post("/api/auth/logout-all")
                .send({
                    email: mockUser.email,
                });

            expect(response.status).toBe(400);
        });

        it("should handle case with no active sessions", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([]);

            const response = await request(app)
                .post("/api/auth/logout-all")
                .send({
                    email: mockUser.email,
                    password: "Password123!",
                });

            expect(response.status).toBe(200);
        });

        it("should remove all sessions from Redis cache", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const sessions = [mockSession, { ...mockSession, id: "session-2" }];
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue(sessions as any);
            vi.spyOn(sessionService, "invalidateSession").mockResolvedValue();

            await request(app).post("/api/auth/logout-all").send({
                email: mockUser.email,
                password: "Password123!",
            });

            // Check that Redis delete was called for cache invalidation
            expect(redisClient.del).toHaveBeenCalled();
        });
    });

    describe("Security Tests", () => {
        it("should hash passwords with bcrypt", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
            vi.spyOn(planService, "getPlanByType").mockResolvedValue(mockPlan);

            const createUserSpy = vi
                .spyOn(userService, "createUser")
                .mockResolvedValue({
                    id: mockUser.id,
                    email: mockUser.email,
                    createdAt: mockUser.createdAt,
                });
            vi.spyOn(
                subscriptionService,
                "createSubscription",
            ).mockResolvedValue({} as any);

            await request(app).post("/api/auth/register").send({
                email: "test@example.com",
                password: "Password123!",
            });

            expect(createUserSpy).toHaveBeenCalled();
        });

        it("should not expose sensitive user data in responses", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan,
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([]);
            vi.spyOn(sessionService, "createSession").mockResolvedValue(
                mockSession as any,
            );

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "550e8400-e29b-41d4-a716-446655440000",
                deviceType: "WEB",
            });

            expect(response.body.data.user).not.toHaveProperty("passwordHash");
            expect(response.body.data.session).not.toHaveProperty(
                "refreshTokenHash",
            );
        });

        it("should use httpOnly cookies for WEB refresh tokens", async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(
                mockUser as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            const mockSubscription = {
                id: "sub-123",
                userId: mockUser.id,
                planId: mockPlan.id,
                plan: mockPlan,
            };
            vi.spyOn(
                subscriptionService,
                "getSubscriptionByUser",
            ).mockResolvedValue(mockSubscription as any);
            vi.spyOn(
                sessionService,
                "getActiveSessionsByUser",
            ).mockResolvedValue([]);
            vi.spyOn(sessionService, "createSession").mockResolvedValue(
                mockSession as any,
            );

            const response = await request(app).post("/api/auth/login").send({
                email: mockUser.email,
                password: "Password123!",
                deviceId: "550e8400-e29b-41d4-a716-446655440000",
                deviceType: "WEB",
            });

            const setCookie = response.headers["set-cookie"];
            expect(setCookie).toBeDefined();

            if (setCookie) {
                const cookieString = Array.isArray(setCookie)
                    ? setCookie[0]
                    : setCookie;
                expect(cookieString).toContain("HttpOnly");
                expect(cookieString).toContain("refreshToken=");
            }
        });

        it("should prevent token reuse after refresh", async () => {
            const validAccessToken = generateAccessToken(
                mockUser.id,
                mockSession.id,
                mockSession.deviceId,
            );
            const validRefreshToken = generateRefreshToken();

            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
            vi.mocked(bcrypt.hash).mockResolvedValue("new-hash" as never);

            const updateSpy = vi
                .spyOn(sessionService, "updateSessionRefreshToken")
                .mockResolvedValue();

            await request(app).post("/api/auth/refresh").send({
                deviceType: "ANDROID",
                accessToken: validAccessToken,
                refreshToken: validRefreshToken,
            });

            // Verify that refresh token was rotated
            expect(updateSpy).toHaveBeenCalledWith(
                mockSession.id,
                expect.any(String), // New hash
            );
        });

        it("should validate JWT signature", async () => {
            const invalidToken =
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyJ9.invalid";

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${invalidToken}`);

            expect(response.status).toBe(401);
        });

        it("should enforce session expiration", async () => {
            const validAccessToken = generateAccessToken(
                mockUser.id,
                mockSession.id,
                mockSession.deviceId,
            );

            vi.spyOn(userService, "getUser").mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                createdAt: mockUser.createdAt,
            });
            vi.spyOn(sessionService, "getSession").mockResolvedValue({
                ...mockSession,
                expiresAt: new Date(Date.now() - 1000), // Expired
            } as any);

            const response = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("expired");
        });
    });

    describe("Redis Caching Tests", () => {
        const validAccessToken = generateAccessToken(
            mockUser.id,
            mockSession.id,
            mockSession.deviceId,
        );

        it("should cache session on first auth middleware call", async () => {
            vi.mocked(redisClient.get).mockResolvedValue(null); // Cache miss
            vi.mocked(redisClient.setEx).mockResolvedValue("OK");

            vi.spyOn(userService, "getUser").mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                createdAt: mockUser.createdAt,
            });
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.spyOn(
                sessionService,
                "updateSessionLastUsedAt",
            ).mockResolvedValue();
            vi.spyOn(sessionService, "invalidateSession").mockResolvedValue();

            await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(redisClient.setEx).toHaveBeenCalledWith(
                expect.stringContaining("session:"),
                expect.any(Number),
                expect.any(String),
            );
        });

        it("should use cached session on subsequent calls", async () => {
            const cachedSession = JSON.stringify(mockSession);
            vi.mocked(redisClient.get).mockResolvedValue(cachedSession);

            const getSessionSpy = vi.spyOn(sessionService, "getSession");
            vi.spyOn(
                sessionService,
                "updateSessionLastUsedAt",
            ).mockResolvedValue();
            vi.spyOn(sessionService, "invalidateSession").mockResolvedValue();

            await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            // Should NOT call database since cache hit
            expect(getSessionSpy).not.toHaveBeenCalled();
        });

        it("should invalidate cache on logout", async () => {
            vi.mocked(redisClient.get).mockResolvedValue(null);
            vi.mocked(redisClient.setEx).mockResolvedValue("OK");
            const delSpy = vi.mocked(redisClient.del).mockResolvedValue(1);

            vi.spyOn(userService, "getUser").mockResolvedValue({
                id: mockUser.id,
                email: mockUser.email,
                createdAt: mockUser.createdAt,
            });
            vi.spyOn(sessionService, "getSession").mockResolvedValue(
                mockSession as any,
            );
            vi.spyOn(
                sessionService,
                "updateSessionLastUsedAt",
            ).mockResolvedValue();
            vi.spyOn(sessionService, "invalidateSession").mockResolvedValue();

            await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(delSpy).toHaveBeenCalled();
        });
    });
});

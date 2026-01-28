import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app";
import * as contentService from "../services/content.service";
import * as userService from "../services/user.service";
import * as sessionService from "../services/session.service";
import { redisClient } from "../configs/redis.config";
import { ApiError } from "../utils/errorHandler";
import jwt from "jsonwebtoken";
import {
    PlanType,
    ContentType,
    VideoQuality,
} from "../../generated/prisma/enums";

// Mock rate limiters to disable rate limiting in tests
vi.mock("../middlewares/limiters.middleware", () => ({
    globalLimiter: (req: any, res: any, next: any) => next(),
    authLimiter: (req: any, res: any, next: any) => next(),
    contentLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock Redis (for auth middleware - session caching)
vi.mock("../configs/redis.config", () => ({
    redisClient: {
        get: vi.fn(),
        setEx: vi.fn(),
        del: vi.fn(),
    },
    CACHE_KEYS: {
        SESSION: (sessionId: string) => `session:${sessionId}`,
        USER_SUBSCRIPTION: (userId: string) => `user:subscription:${userId}`,
        CONTENT_LIST: (planId: number) => `content:list:${planId}`,
        CONTENT_ITEM: (contentId: string, planId: number) =>
            `content:item:${contentId}:${planId}`,
        CONTENT_BY_TYPE: (planId: number, type: string) =>
            `content:type:${planId}:${type}`,
        CONTENT_BY_GENRE: (planId: number, genre: string) =>
            `content:genre:${planId}:${genre}`,
    },
    CACHE_TTL: {
        SESSION: 15 * 60,
        USER_SUBSCRIPTION: 15 * 60,
        CONTENT: 24 * 60 * 60,
    },
}));

describe("Content Access Control Tests", () => {
    // Helper function to generate valid JWT tokens
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

    // Mock data
    const mockUser = {
        id: "user-123",
        email: "test@example.com",
    };

    const mockSession = {
        id: "session-123",
        userId: mockUser.id,
        deviceId: "device-123",
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    let validAccessToken: string;

    beforeEach(() => {
        vi.clearAllMocks();
        validAccessToken = generateAccessToken(
            mockUser.id,
            mockSession.id,
            mockSession.deviceId,
        );

        // Mock user service - getUser() called by authMiddleware
        vi.spyOn(userService, "getUser").mockResolvedValue({
            id: mockUser.id,
            email: mockUser.email,
            createdAt: new Date(),
        });

        // Mock session service - getSession() called by authMiddleware
        vi.spyOn(sessionService, "getSession").mockResolvedValue(
            mockSession as any,
        );

        // Mock session service - updateSessionLastUsedAt() called by authMiddleware
        vi.spyOn(sessionService, "updateSessionLastUsedAt").mockResolvedValue(
            undefined,
        );

        // Mock getUserSubscription for controllers
        vi.spyOn(contentService, "getUserSubscription").mockResolvedValue({
            userId: mockUser.id,
            planId: 1,
            plan: {
                id: 1,
                type: PlanType.FREE,
                maxDevices: 1,
            },
        } as any);

        // Mock Redis for session caching - cache miss scenario
        vi.mocked(redisClient.get).mockResolvedValue(null);
        vi.mocked(redisClient.setEx).mockResolvedValue("OK" as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Authentication Requirements", () => {
        it("should return 401 if no access token provided", async () => {
            const response = await request(app).get(
                "/api/content/content-id-1",
            );

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("token");
        });

        it("should return 401 if session is revoked", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue({
                ...mockSession,
                isRevoked: true,
            } as any);

            const response = await request(app)
                .get("/api/content/content-id-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("revoked");
        });

        it("should return 401 if session is expired", async () => {
            vi.spyOn(sessionService, "getSession").mockResolvedValue({
                ...mockSession,
                expiresAt: new Date(Date.now() - 1000),
            } as any);

            const response = await request(app)
                .get("/api/content/content-id-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("expired");
        });

        it("should return 401 for invalid JWT token", async () => {
            const response = await request(app)
                .get("/api/content/content-id-1")
                .set("Authorization", "Bearer invalid-token");

            expect(response.status).toBe(401);
        });

        it("should return 401 for expired JWT token", async () => {
            const expiredToken = jwt.sign(
                {
                    userId: mockUser.id,
                    sessionId: mockSession.id,
                    deviceId: mockSession.deviceId,
                },
                process.env.JWT_ACCESS_TOKEN_SECRET || "test-access-secret",
                { expiresIn: "-1h" },
            );

            const response = await request(app)
                .get("/api/content/content-id-1")
                .set("Authorization", `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
        });

        it("should return 401 if user does not exist", async () => {
            // Mock user service to return null (user not found)
            vi.spyOn(userService, "getUser").mockResolvedValue(null);

            const response = await request(app)
                .get("/api/content/content-id-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toContain("User not found");
        });

        it("should authenticate successfully and call all service methods", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-1",
                title: "Test Content",
                description: "Test Description",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date(),
                rating: "4.5",
                contentType: ContentType.MOVIE,
                genres: ["Action"],
                videoQuality: VideoQuality.HD,
                isActive: true,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify content service was called with contentId and planId
            expect(contentService.getContentForUser).toHaveBeenCalledWith(
                "content-1",
                1, // planId from mock subscription
            );

            // Verify auth middleware called the service methods
            expect(userService.getUser).toHaveBeenCalledWith(mockUser.id);
            expect(sessionService.getSession).toHaveBeenCalledWith(
                mockSession.id,
            );
            expect(sessionService.updateSessionLastUsedAt).toHaveBeenCalledWith(
                mockSession.id,
            );
        });
    });

    describe("Plan-Based Content Access - FREE Plan", () => {
        it("should allow access to FREE tier content with SD quality", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-free-1",
                title: "Free Movie",
                description: "Available for all plans",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date("2024-01-01"),
                rating: "4.5",
                contentType: ContentType.MOVIE,
                genres: ["Action", "Drama"],
                videoQuality: VideoQuality.SD,
                isActive: true,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-free-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.content.videoQuality).toBe(
                VideoQuality.SD,
            );
            expect(contentService.getContentForUser).toHaveBeenCalledWith(
                "content-free-1",
                1, // planId
            );
        });

        it("should deny access to PREMIUM content for FREE users", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-premium-1",
                title: "Premium Movie",
                description: "Premium content",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date("2024-01-01"),
                rating: "4.5",
                contentType: ContentType.MOVIE,
                genres: ["Action"],
                videoQuality: VideoQuality.UHD,
                isActive: true,
                hasAccess: false, // No access for FREE plan
            });

            const response = await request(app)
                .get("/api/content/content-premium-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(403);
            expect(response.body.message).toContain("not available");
            expect(response.body.message).toContain(PlanType.FREE);
        });

        it("should deny access to BASIC content for FREE users", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-basic-1",
                title: "Basic Series",
                description: "Basic content",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date("2024-01-01"),
                rating: "4.5",
                contentType: ContentType.SERIES,
                genres: ["Comedy"],
                videoQuality: VideoQuality.HD,
                isActive: true,
                hasAccess: false,
            });

            const response = await request(app)
                .get("/api/content/content-basic-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(403);
            expect(response.body.message).toContain("upgrade");
        });
    });

    describe("Plan-Based Content Access - BASIC Plan", () => {
        it("should allow access to BASIC tier content with HD quality", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-basic-1",
                title: "Basic Series",
                description: "Available for Basic and Premium",
                poster: "poster-basic.jpg",
                thumbnail: "thumb-basic.jpg",
                duration: 45,
                releaseDate: new Date("2024-03-15"),
                rating: "4.2",
                contentType: ContentType.SERIES,
                genres: ["Comedy"],
                videoQuality: VideoQuality.HD,
                isActive: true,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-basic-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.content.videoQuality).toBe(
                VideoQuality.HD,
            );
        });

        it("should deny access to PREMIUM-only content for BASIC users", async () => {
            vi.spyOn(contentService, "getUserSubscription").mockResolvedValue({
                userId: mockUser.id,
                planId: 2,
                plan: { id: 2, type: PlanType.BASIC, maxDevices: 2 },
            } as any);

            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-premium-1",
                title: "Premium Movie",
                description: "Premium content",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date("2024-01-01"),
                rating: "4.5",
                contentType: ContentType.MOVIE,
                genres: ["Action"],
                videoQuality: VideoQuality.UHD,
                isActive: true,
                hasAccess: false,
            });

            const response = await request(app)
                .get("/api/content/content-premium-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(403);
            expect(response.body.message).toContain(PlanType.BASIC);
        });
    });

    describe("Plan-Based Content Access - PREMIUM Plan", () => {
        it("should allow access to PREMIUM content with UHD quality", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-premium-1",
                title: "Premium Movie",
                description: "Premium only content",
                poster: "poster-premium.jpg",
                thumbnail: "thumb-premium.jpg",
                duration: 150,
                releaseDate: new Date("2024-06-01"),
                rating: "4.8",
                contentType: ContentType.MOVIE,
                genres: ["Sci-Fi"],
                videoQuality: VideoQuality.UHD,
                isActive: true,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-premium-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.content.videoQuality).toBe(
                VideoQuality.UHD,
            );
        });

        it("should allow access to BASIC content", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-basic-1",
                title: "Basic Series",
                description: "Available for Basic and Premium",
                poster: "poster-basic.jpg",
                thumbnail: "thumb-basic.jpg",
                duration: 45,
                releaseDate: new Date("2024-03-15"),
                rating: "4.2",
                contentType: ContentType.SERIES,
                genres: ["Comedy"],
                videoQuality: VideoQuality.HD,
                isActive: true,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-basic-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
        });

        it("should allow access to FREE content", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-free-1",
                title: "Free Movie",
                description: "Available for all plans",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date("2024-01-01"),
                rating: "4.5",
                contentType: ContentType.MOVIE,
                genres: ["Action", "Drama"],
                videoQuality: VideoQuality.SD,
                isActive: true,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-free-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(200);
        });
    });

    describe("Content Access Validation", () => {
        it("should return 403 if user has no subscription", async () => {
            vi.spyOn(contentService, "getUserSubscription").mockResolvedValue(
                null,
            );

            const response = await request(app)
                .get("/api/content/content-free-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(403);
            expect(response.body.message).toContain("subscription");
        });

        it("should return 404 if content does not exist", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue(
                null,
            );

            const response = await request(app)
                .get("/api/content/non-existent-id")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain("not found");
        });

        it("should return 404 if content is inactive", async () => {
            vi.spyOn(contentService, "getContentForUser").mockResolvedValue({
                id: "content-inactive-1",
                title: "Inactive Content",
                description: "Not active",
                poster: "poster.jpg",
                thumbnail: "thumb.jpg",
                duration: 120,
                releaseDate: new Date("2024-01-01"),
                rating: "4.5",
                contentType: ContentType.MOVIE,
                genres: ["Action"],
                videoQuality: VideoQuality.SD,
                isActive: false,
                hasAccess: true,
            });

            const response = await request(app)
                .get("/api/content/content-inactive-1")
                .set("Authorization", `Bearer ${validAccessToken}`);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain("not available");
        });
    });

    describe("Watch Progress - Access Control Integration", () => {
        it("should allow progress update only for accessible content (FREE plan)", async () => {
            vi.spyOn(contentService, "canUserAccessContent").mockResolvedValue(
                true,
            );
            vi.spyOn(contentService, "updateWatchProgress").mockResolvedValue({
                id: "history-1",
                userId: mockUser.id,
                contentId: "content-free-1",
                progress: 75,
                completed: false,
                watchedAt: new Date(),
            });

            const response = await request(app)
                .post("/api/content/content-free-1/progress")
                .set("Authorization", `Bearer ${validAccessToken}`)
                .send({ progress: 75, completed: false });

            expect(response.status).toBe(200);
            expect(response.body.data.progress).toBe(75);
            expect(contentService.canUserAccessContent).toHaveBeenCalledWith(
                mockUser.id,
                "content-free-1",
            );
        });

        it("should deny progress update for PREMIUM content by FREE user", async () => {
            vi.spyOn(contentService, "canUserAccessContent").mockResolvedValue(
                false,
            );

            const response = await request(app)
                .post("/api/content/content-premium-1/progress")
                .set("Authorization", `Bearer ${validAccessToken}`)
                .send({ progress: 50, completed: false });

            expect(response.status).toBe(403);
            expect(response.body.message).toContain("don't have access");
        });

        it("should allow PREMIUM user to update progress on premium content", async () => {
            vi.spyOn(contentService, "canUserAccessContent").mockResolvedValue(
                true,
            );
            vi.spyOn(contentService, "updateWatchProgress").mockResolvedValue({
                id: "history-1",
                userId: mockUser.id,
                contentId: "content-premium-1",
                progress: 100,
                completed: true,
                watchedAt: new Date(),
            });

            const response = await request(app)
                .post("/api/content/content-premium-1/progress")
                .set("Authorization", `Bearer ${validAccessToken}`)
                .send({ progress: 100, completed: true });

            expect(response.status).toBe(200);
            expect(response.body.data.completed).toBe(true);
        });

        it("should deny BASIC user from updating progress on PREMIUM-only content", async () => {
            vi.spyOn(contentService, "canUserAccessContent").mockResolvedValue(
                false,
            );

            const response = await request(app)
                .post("/api/content/content-premium-1/progress")
                .set("Authorization", `Bearer ${validAccessToken}`)
                .send({ progress: 50, completed: false });

            expect(response.status).toBe(403);
        });

        it("should return 400 if progress is negative", async () => {
            const response = await request(app)
                .post("/api/content/content-free-1/progress")
                .set("Authorization", `Bearer ${validAccessToken}`)
                .send({ progress: -10, completed: false });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain("non-negative");
        });

        it("should return 400 if progress is undefined", async () => {
            const response = await request(app)
                .post("/api/content/content-free-1/progress")
                .set("Authorization", `Bearer ${validAccessToken}`)
                .send({ completed: false });

            expect(response.status).toBe(400);
        });
    });
});

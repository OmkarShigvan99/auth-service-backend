import { createClient } from "redis";

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error("Redis connection failed after 10 retries");
                return new Error("Redis connection failed");
            }
            return Math.min(retries * 100, 3000);
        },
    },
});

redisClient.on("error", (err) => {
    console.error("Redis Client Error:", err);
});

redisClient.on("connect", () => {
    console.log("Redis client connected");
});

redisClient.on("ready", () => {
    console.log("Redis client ready");
});

// Connect to Redis
await redisClient.connect();

// Cache key prefixes
export const CACHE_KEYS = {
    SESSION: (sessionId: string) => `session:${sessionId}`,
    USER_SUBSCRIPTION: (userId: string) => `user:subscription:${userId}`,
    CONTENT_LIST: (planId: number) => `content:plan:${planId}`,
    CONTENT_ITEM: (contentId: string, planId: number) =>
        `content:${contentId}:plan:${planId}`,
    CONTENT_BY_TYPE: (planId: number, contentType: string) =>
        `content:plan:${planId}:type:${contentType}`,
    CONTENT_BY_GENRE: (planId: number, genre: string) =>
        `content:plan:${planId}:genre:${genre}`,
};

// Cache TTL in seconds
export const CACHE_TTL = {
    SESSION: 15 * 60, // 15 minutes (matches access token expiry)
    USER_SUBSCRIPTION: 15 * 60, // 15 minutes
    CONTENT: 24 * 60 * 60, // 1 day
};

export { redisClient };

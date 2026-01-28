import {
    AUTH_LIMITER_MAX_REQUESTS,
    AUTH_LIMITER_MESSAGE,
    AUTH_LIMITER_WINDOW_MS,
    CONTENT_LIMITER_MAX_REQUESTS,
    CONTENT_LIMITER_MESSAGE,
    CONTENT_LIMITER_WINDOW_MS,
    GLOBAL_LIMITER_MAX_REQUESTS,
    GLOBAL_LIMITER_MESSAGE,
    GLOBAL_LIMITER_WINDOW_MS,
} from "../constants/limiters.constant";
import { createRateLimiter } from "../utils/rateLimits";

// GLOBAL LIMITER – general rate limiting for all requests
export const globalLimiter = createRateLimiter({
    windowMs: GLOBAL_LIMITER_WINDOW_MS,
    max: GLOBAL_LIMITER_MAX_REQUESTS,
    message: GLOBAL_LIMITER_MESSAGE,
});

// LOGIN / AUTH LIMITER – brute-force protection
export const authLimiter = createRateLimiter({
    windowMs: AUTH_LIMITER_WINDOW_MS,
    max: AUTH_LIMITER_MAX_REQUESTS,
    message: AUTH_LIMITER_MESSAGE,
});

// CONTENT LIMITER – normal API usage
export const contentLimiter = createRateLimiter({
    windowMs: CONTENT_LIMITER_WINDOW_MS,
    max: CONTENT_LIMITER_MAX_REQUESTS,
    message: CONTENT_LIMITER_MESSAGE,
});

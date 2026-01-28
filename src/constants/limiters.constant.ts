export const GLOBAL_LIMITER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const GLOBAL_LIMITER_MAX_REQUESTS = 1000;
export const GLOBAL_LIMITER_MESSAGE = "Too many requests. Please slow down.";

export const AUTH_LIMITER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_LIMITER_MAX_REQUESTS = 5;
export const AUTH_LIMITER_MESSAGE =
    "Too many login attempts. Try again later after some time.";

export const CONTENT_LIMITER_WINDOW_MS = 1 * 60 * 1000; // 1 minute
export const CONTENT_LIMITER_MAX_REQUESTS = 60;
export const CONTENT_LIMITER_MESSAGE =
    "Too many requests. Please try again later after some time.";

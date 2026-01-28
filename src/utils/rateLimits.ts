import rateLimit from "express-rate-limit";

export const createRateLimiter = ({
    windowMs,
    max,
    message,
}: {
    windowMs: number;
    max: number;
    message: string;
}) =>
    rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: true,
        message: {
            success: false,
            message,
        },
    });

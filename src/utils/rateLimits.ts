import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

export const createRateLimiter = ({
    windowMs,
    max,
    message,
}: {
    windowMs: number;
    max: number;
    message: string;
}) => {
    if (process.env.NODE_ENV === "production") {
        return rateLimit({
            windowMs,
            max,
            message,
            standardHeaders: true,
            legacyHeaders: false,
        });
    } else {
        return (req: Request, _res: Response, next: NextFunction) => next();
    }
};

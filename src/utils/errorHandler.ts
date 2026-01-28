import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "./ApiResponse";
import { StatusCodes } from "http-status-codes";

// Custom error class
export class ApiError<T> extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public isOperational: boolean = true,
        public data?: T | null,
    ) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
    }
}

// Async wrapper to catch errors
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch((reason) => {
            next(reason);
        });
    };
};

// Global error handling middleware
export const errorHandler = (
    err: Error | ApiError<any>,
    _req: Request,
    res: Response,
    next: NextFunction,
) => {
    console.error(err, "Error occurred");
    if (err instanceof ApiError) {
        const response = new ApiResponse(
            err.statusCode,
            err.message,
            err.data ?? null,
        );
        return res.status(response.httpStatus).json(response);
    }

    // Prisma errors
    if (err.name === "PrismaClientKnownRequestError") {
        console.error(err, "Database error occurred");
        const response = new ApiResponse(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Database error occurred",
            null,
        );
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }

    // Invalid JSON Body
    if (err instanceof SyntaxError && "body" in err) {
        return res
            .status(StatusCodes.BAD_REQUEST)
            .json(
                new ApiResponse(
                    StatusCodes.BAD_REQUEST,
                    "Invalid JSON format in request body",
                    null,
                ),
            );
    }

    // Unexpected errors
    console.error(err, "Unexpected error occurred");
    const response = new ApiResponse(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Internal server error",
        null,
    );
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};

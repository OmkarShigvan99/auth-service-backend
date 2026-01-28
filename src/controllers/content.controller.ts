import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/errorHandler";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
    getAvailableContentForUser,
    getContentForUser,
    getContentByTypeForUser,
    getContentByGenreForUser,
    canUserAccessContent,
    getWatchHistory,
    updateWatchProgress,
} from "../services/content.service";
import { ContentType } from "../../generated/prisma/enums";

// Get all content available for the authenticated user
export async function getAllContentController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const userId = user?.userId as string;

    const content = await getAvailableContentForUser(userId);

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            count: content.length,
            content,
        }),
    );
}

// Get a single content by ID with access control
export async function getContentByIdController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { contentId } = req.params;
    const userId = user?.userId as string;

    const content = await getContentForUser(userId, contentId as string);

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            content,
        }),
    );
}

// Get content by type
export async function getContentByTypeController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { contentType } = req.params;
    const userId = user?.userId as string;

    const content = await getContentByTypeForUser(
        userId,
        contentType as ContentType,
    );

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            count: content.length,
            content,
        }),
    );
}

// Get content by genre
export async function getContentByGenreController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { genre } = req.params;
    const userId = user?.userId as string;

    const content = await getContentByGenreForUser(userId, genre as string);

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Content retrieved successfully", {
            count: content.length,
            content,
        }),
    );
}

// Get watch history
export async function getWatchHistoryController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const userId = user?.userId as string;

    const history = await getWatchHistory(userId);

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Watch history retrieved", {
            count: history.length,
            history,
        }),
    );
}

// Update watch progress
export async function updateWatchProgressController(
    req: Request,
    res: Response,
): Promise<void> {
    const { user } = req as AuthenticatedRequest;
    const { contentId } = req.params;
    const { progress, completed } = req.body;
    const userId = user?.userId as string;

    // Validate input
    if (progress === undefined || progress < 0) {
        throw new ApiError(
            StatusCodes.BAD_REQUEST,
            "Progress must be a non-negative number",
        );
    }

    // Check if user can access this content first
    const canAccess = await canUserAccessContent(userId, contentId as string);
    if (!canAccess) {
        throw new ApiError(
            StatusCodes.FORBIDDEN,
            "You don't have access to this content",
        );
    }

    const result = await updateWatchProgress(
        userId,
        contentId as string,
        progress,
        completed,
    );

    res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, "Watch progress updated", {
            contentId: result.contentId,
            progress: result.progress,
            completed: result.completed,
        }),
    );
}

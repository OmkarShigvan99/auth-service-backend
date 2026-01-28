import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/errorHandler";
import {
    getAllContentController,
    getContentByIdController,
    getContentByTypeController,
    getContentByGenreController,
    getWatchHistoryController,
    updateWatchProgressController,
} from "../controllers/content.controller";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all available content for the user
router.get("/", asyncHandler(getAllContentController));

// Get content by type (MOVIE, SERIES, DOCUMENTARY, etc.)
router.get("/type/:contentType", asyncHandler(getContentByTypeController));

// Get content by genre
router.get("/genre/:genre", asyncHandler(getContentByGenreController));

// Get a specific content by ID (with access control)
router.get("/:contentId", asyncHandler(getContentByIdController));

// Get user's watch history
router.get("/history/all", asyncHandler(getWatchHistoryController));

// Update watch progress for a content
router.post(
    "/:contentId/progress",
    asyncHandler(updateWatchProgressController),
);

export default router;

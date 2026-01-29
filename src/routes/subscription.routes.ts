import { Router } from "express";
import { asyncHandler } from "../utils/errorHandler";
import {
    updateUserSubscriptionController,
    getCurrentUserSubscriptionController,
} from "../controllers/subscription.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validator } from "../middlewares/validator.middleware";
import { subscriptionSchema } from "../validation-schemas/subscription.schema";

const router = Router();

router.get(
    "/me",
    authMiddleware,
    asyncHandler(getCurrentUserSubscriptionController),
);

router.post(
    "/update",
    validator({
        check: "body",
        validationSchema: subscriptionSchema,
    }),
    authMiddleware,
    asyncHandler(updateUserSubscriptionController),
);

export default router;

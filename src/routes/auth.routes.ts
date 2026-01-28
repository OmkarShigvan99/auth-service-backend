import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { verifyRefreshTokenMiddleware } from "../middlewares/refresh-token.middleware";
import { validator } from "../middlewares/validator.middleware";
import {
    loginSchema,
    refreshSchema,
    registerSchema,
} from "../validation-schemas/auth.schema";
import { asyncHandler } from "../utils/errorHandler";
import {
    loginController,
    logoutAllController,
    logoutController,
    registerController,
    refreshAccessTokenController,
} from "../controllers/auth.controller";

const router = Router();

router.post(
    "/register",
    validator({
        check: "body",
        validationSchema: registerSchema,
    }),
    asyncHandler(registerController),
);

router.post(
    "/login",
    validator({
        check: "body",
        validationSchema: loginSchema,
    }),
    asyncHandler(loginController),
);

router.post("/logout", authMiddleware, asyncHandler(logoutController));

router.post("/logout-all", authMiddleware, asyncHandler(logoutAllController));

router.post(
    "/refresh",
    validator({
        check: "body",
        validationSchema: refreshSchema,
    }),
    asyncHandler(verifyRefreshTokenMiddleware),
    asyncHandler(refreshAccessTokenController),
);

export default router;

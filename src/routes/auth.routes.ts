import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { verifyRefreshTokenMiddleware } from "../middlewares/refresh-token.middleware";
import { validator } from "../middlewares/validator.middleware";
import {
    loginSchema,
    logoutAllSchema,
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
import { authLimiter } from "../middlewares/limiters.middleware";

const router = Router();

router.post(
    "/register",
    validator({
        check: "body",
        validationSchema: registerSchema,
    }),
    asyncHandler(registerController),
);

router.use(authLimiter).post(
    "/login",
    validator({
        check: "body",
        validationSchema: loginSchema,
    }),
    asyncHandler(loginController),
);

router.post("/logout", authMiddleware, asyncHandler(logoutController));

router.post(
    "/logout-all",
    validator({
        check: "body",
        validationSchema: logoutAllSchema,
    }),
    asyncHandler(logoutAllController),
);

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

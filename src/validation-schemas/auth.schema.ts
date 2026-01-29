import { z } from "zod";

export const registerSchema = z.object({
    email: z.email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(
            /[^A-Za-z0-9]/,
            "Password must contain at least one special character",
        ),
});

export const loginSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    deviceId: z.uuidv4("Invalid device ID. Must be a valid UUIDv4"),
    deviceType: z.enum(["WEB", "ANDROID", "IOS"]),
    deviceName: z.string().max(100).optional(),
    logoutStrategy: z.enum(["LOGOUT_LEAST_RECENT", "LOGOUT_ALL"]).optional(),
});

export const refreshSchema = z.discriminatedUnion("deviceType", [
    z.object({
        deviceType: z.literal("WEB"),
        accessToken: z.string().min(1, "Access token is required"),
        // refreshToken comes from httpOnly cookie
    }),

    z.object({
        deviceType: z.enum(["ANDROID", "IOS"]),
        accessToken: z.string().min(1, "Access token is required"),
        refreshToken: z.string().min(1, "Refresh token is required"),
    }),
]);

export const logoutAllSchema = z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutAllInput = z.infer<typeof logoutAllSchema>;

# API & Integration Guide

This guide outlines the major routes, request/response shapes, and how a frontend can integrate Access/Refresh token pairs across devices while respecting concurrent screen limits.

## Base URL

- `{{baseUrl}}` (e.g., `http://localhost:3000`)

## Authentication Routes

- `POST /api/auth/register`
    - Body: `{ email, password }`
    - Response: `{ id, email }`
- `POST /api/auth/login`
    - Body: `{ email, password, deviceId, deviceName?, deviceType, logoutStrategy? }`
        - `deviceType`: `WEB` | `ANDROID` | `IOS`
        - `logoutStrategy` (optional): `LOGOUT_ALL` | `LOGOUT_LEAST_RECENT`
    - Success Response:
        ```json
        {
            "success": true,
            "message": "Login successful",
            "data": {
                "user": { "id": "...", "email": "..." },
                "session": {
                    "id": "...",
                    "deviceId": "...",
                    "accessToken": "jwt...",
                    "expiresIn": 900,
                    "refreshToken": "64-hex" // only for ANDROID/IOS
                }
            }
        }
        ```
    - Error when device limit reached (no strategy provided):
        ```json
        {
            "success": false,
            "message": "Device limit reached for your plan (PLAN).",
            "error": {
                "error": "DEVICE_LIMIT_REACHED",
                "options": ["LOGOUT_ALL", "LOGOUT_LEAST_RECENT"],
                "activeSessions": [{ "deviceName": "...", "lastUsedAt": "..." }]
            }
        }
        ```
- `POST /api/auth/logout` (Protected)
    - Header: `Authorization: Bearer <accessToken>`
    - Revokes current session; clears Redis cache for this session.
- `POST /api/auth/logout-all` (Protected)
    - Header: `Authorization: Bearer <accessToken>`
    - Revokes all active sessions for the user; clears Redis cache for sessions.
- `POST /api/auth/refresh`
    - Body: `{ deviceType, accessToken, refreshToken? }`
        - `WEB`: `refreshToken` read from httpOnly cookie.
        - `ANDROID/IOS`: submit `refreshToken` in body.
    - Response:
        ```json
        {
            "success": true,
            "message": "Token refreshed successfully",
            "data": {
                "accessToken": "jwt...",
                "expiresIn": 900,
                "refreshToken": "64-hex" /* only for mobile */
            }
        }
        ```

## Subscription Routes

- `GET /api/subscription/me` (Protected)
    - Header: `Authorization: Bearer <accessToken>`
    - Response: current subscription including `plan` details.
- `POST /api/subscription/update` (Protected)
    - Header: `Authorization: Bearer <accessToken>`
    - Body: `{ "plan": "FREE|BASIC|PREMIUM|ULTRA_PREMIUM" }`
    - On success: invalidates `user:subscription:{userId}` cache.

## Content Routes (Protected)

All require: `Authorization: Bearer <accessToken>` and are rate-limited for normal usage.

- `GET /api/content/`
    - Returns all accessible content for current plan; cached per `planId`.
- `GET /api/content/type/:contentType`
    - `contentType`: `MOVIE|SERIES|DOCUMENTARY|SHOW|SPORTS|KIDS`
    - Returns content for type; cached per plan+type.
- `GET /api/content/genre/:genre`
    - Returns content for genre; cached per plan+genre.
- `GET /api/content/:contentId`
    - Validates availability and plan access; caches item snapshot.
- `GET /api/content/history/all`
    - Returns watch history for the user.
- `POST /api/content/:contentId/progress`
    - Body: `{ progress: number, completed?: boolean }`
    - Updates watch progress; checks content access before write.

## Authentication Integration (Frontend)

### Tokens

- **Access Token**: short-lived (~15m). Use in `Authorization: Bearer` for protected routes.
- **Refresh Token**: long-lived (~7 days), device-bound.
    - `WEB`: stored in httpOnly cookie (not accessible to JS) sent only to `/api/auth/refresh`.
    - `ANDROID/IOS`: store securely (Keychain/Keystore).

### Recommended Flow

1. On login success, save `accessToken` and expiration timestamp. For mobile, also save `refreshToken`.
2. Attach `Authorization` for all protected calls.
3. On `401` due to token expiry:
    - Call `/api/auth/refresh` with `deviceType` and the latest `accessToken` (expired is OK for payload extraction). For mobile, include `refreshToken`.
    - Replace stored tokens with the response (note refresh **rotates** each call).
4. On logout (single device): delete stored tokens; call `/api/auth/logout`.
5. On global logout: call `/api/auth/logout-all`; delete tokens across devices.

### Handling Screen Limits

- If login returns `DEVICE_LIMIT_REACHED`:
    - Show the list of active devices.
    - Offer actions:
        - **Logout All**: retry login with `logoutStrategy = LOGOUT_ALL`.
        - **Logout Least Recent**: retry with `logoutStrategy = LOGOUT_LEAST_RECENT`.

## Error Shapes

- Standard error:
    ```json
    { "success": false, "message": "..." }
    ```
- Validation errors include descriptive messages; rate limiters return user-friendly strings.

## Security Notes

- Never store refresh tokens in localStorage on web; rely on httpOnly cookies.
- Always prefix `Authorization: Bearer` exactly.
- Use secure storage on mobile; rotate refresh tokens on each refresh.

## Postman

A ready-to-use Postman collection is included at `postman_collection.json` with sample requests for Auth, Subscription, and Content flows.

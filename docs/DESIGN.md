# Design: Auth & Subscription Platform

## System Architecture

- **API Layer (Express)**: Receives HTTP requests, applies security middleware (Helmet, rate limiting), routes to controllers.
- **Authentication**: Short-lived Access Token (JWT) validated on protected endpoints, with device-aware payload `{ userId, sessionId, deviceId }`.
- **Session Store (PostgreSQL + Redis)**:
    - PostgreSQL is the source of truth for `Session`, `User`, and `Subscription` data.
    - Redis caches hot paths: `session:{sessionId}`, `user:subscription:{userId}`, and content lists per plan.
    - Cache-aside strategy: read-through on miss, TTL-based expiration, and invalidation on critical mutations.
- **Content Access**: Plan-aware content retrieval with `ContentAccess` mapping `Plan -> Content` + allowed `VideoQuality`.

Request flow (protected endpoint):

1. `authMiddleware` extracts and verifies Access Token.
2. It fetches session via Redis cache (`session:{sessionId}`) or database.
3. Validates session state (`isRevoked`, `expiresAt`, `userId` matches payload).
4. Sets `req.user` and continues; updates `lastUsedAt` in DB.

## Database Schema

### Entities

- **User**: `id`, `email`, `passwordHash`, `createdAt` (+ relations: `subscription`, `sessions`, `watchHistory`).
- **Subscription**: `id`, `userId (unique)`, `planId` → `Plan`.
- **Plan**: `id`, `type (FREE/BASIC/PREMIUM/ULTRA_PREMIUM)`, `maxDevices`.
- **Session**: `id`, `userId`, `deviceId` (unique per user), `deviceName?`, `refreshTokenHash`, `isRevoked`, `expiresAt`, `createdAt`, `lastUsedAt?`.
- **Content**: Metadata + `contentType`, `isActive`, relations to `Genre`, `ContentAccess`, `WatchHistory`.
- **ContentAccess**: `contentId`, `planId`, `videoQuality`, unique per `(contentId, planId)`.
- **WatchHistory**: `(userId, contentId)` unique, progress tracking.

### Database Diagram

![Database ER Diagram](docs/images/db-diagram.png)

This ER diagram visualizes the core entities and relations:

- `User` ↔ `Subscription` (1–1) via `userId`.
- `User` ↔ `Session` (1–n) with unique `(userId, deviceId)`.
- `Plan` ↔ `Subscription` (1–n) and ↔ `ContentAccess` (1–n).
- `Content` ↔ `ContentGenre` (1–n) ↔ `Genre` (1–n) for tagging.
- `Content` ↔ `ContentAccess` (1–n) for plan-aware availability and `videoQuality`.
- `User` ↔ `WatchHistory` (1–n) ↔ `Content` (1–n) for viewing progress.

Note: Save the provided diagram image to `docs/images/db-diagram.png` to render it in this document.

## Auth Flow & Screen Limits

### Login

1. Validate credentials; fetch user.
2. Load user subscription and plan; read active sessions count.
3. If `activeSessions >= plan.maxDevices`:
    - If no `logoutStrategy` provided → return `DEVICE_LIMIT_REACHED` with options: `LOGOUT_ALL` or `LOGOUT_LEAST_RECENT`.
    - If provided, apply:
        - `LOGOUT_LEAST_RECENT`: revoke least recent session (DB update).
        - `LOGOUT_ALL`: revoke all sessions.
4. Create a new `Session`:
    - `refreshTokenHash = bcrypt(hash(randomBytes(32)))` (refresh token never stored in plain).
    - `expiresAt = now + 7 days`.
5. Issue Access Token (JWT) with `{ userId, deviceId, sessionId }`, exp ~15m.
6. Return Access Token; set/return Refresh Token depending on `deviceType`:
    - `WEB`: httpOnly cookie (`/api/auth/refresh`).
    - `ANDROID/IOS`: in response body (client stores securely).

### Access Token Verification (authMiddleware)

- Verify JWT → check Redis for `session:{sessionId}`; on miss, fetch DB and cache with TTL.
- Reject if revoked or expired; update `lastUsedAt` on valid session.

### Refresh Flow (Token Rotation)

1. Client calls `/api/auth/refresh` with `deviceType` and a valid refresh token.
2. Middleware verifies:
    - Extract `sessionId` from Access Token (ignore expiry).
    - Get session from DB; verify not revoked/expired.
    - Compare provided refresh token to `refreshTokenHash` via bcrypt.
3. Controller:
    - Issue new Access Token (short-lived).
    - Generate new refresh token; **rotate** by updating `refreshTokenHash` in DB.
    - Return/set refreshed tokens based on `deviceType`.

### Logout

- **Single Device**: `/api/auth/logout` → revoke this `sessionId`; delete Redis key `session:{sessionId}`.
- **Global Logout**: `/api/auth/logout-all` → revoke all active sessions for user; delete all related Redis session keys.

## Redis Strategy

- **Keys**:
    - `session:{sessionId}`: session snapshot (TTL ~ 15m to match access token).
    - `user:subscription:{userId}`: cached subscription (TTL ~ 15m).
    - `content:plan:{planId}` and per-type/genre variants: cached content lists (TTL ~ 24h).
- **Invalidation**:
    - On subscription update: delete `user:subscription:{userId}`.
    - On logout/logout-all: delete `session:{sessionId}` keys.

## Security Implementation

- **JWT**: HS256; payload minimal and device-aware; short expiry; verify & handle common errors.
- **Refresh Tokens**: 32-byte hex, stored only as bcrypt hash; rotated each refresh.
- **Reuse Prevention**: Rotation invalidates old refresh token (hash mismatch on reuse → 401).
- **Helmet**: secure headers.
- **Rate Limiting**:
    - Global: 15m window, 1000 requests.
    - Auth: 15m window, max 5 login attempts.
    - Content: 1m window, 60 requests.

## Scalability Considerations

- Stateless Access Tokens; session reads optimized via Redis.
- Horizontal scaling friendly: Redis central store, DB transactional guarantees.
- Cache TTLs tuned for freshness vs load; invalidation on writes ensures correctness.

## Open Questions (for product/infra alignment)

- Subscription tiers and `maxDevices` values (current: FREE/BASIC/PREMIUM/ULTRA_PREMIUM).
- Preferred DB (current implementation: PostgreSQL). MongoDB variant would require schema adjustments and service changes.
- Token signing algorithm policies (HS256 vs RS256) and key management.
# Design: Auth & Subscription Platform

## System Architecture

- **API Layer (Express)**: Receives HTTP requests, applies security middleware (Helmet, rate limiting), routes to controllers.
- **Authentication**: Short-lived Access Token (JWT) validated on protected endpoints, with device-aware payload `{ userId, sessionId, deviceId }`.
- **Session Store (PostgreSQL + Redis)**:
    - PostgreSQL is the source of truth for `Session`, `User`, and `Subscription` data.
    - Redis caches hot paths: `session:{sessionId}`, `user:subscription:{userId}`, and content lists per plan.
    - Cache-aside strategy: read-through on miss, TTL-based expiration, and invalidation on critical mutations.
- **Content Access**: Plan-aware content retrieval with `ContentAccess` mapping `Plan -> Content` + allowed `VideoQuality`.

Request flow (protected endpoint):

1. `authMiddleware` extracts and verifies Access Token.
2. It fetches session via Redis cache (`session:{sessionId}`) or database.
3. Validates session state (`isRevoked`, `expiresAt`, `userId` matches payload).
4. Sets `req.user` and continues; updates `lastUsedAt` in DB.

## Database Schema

### Entities

- **User**: `id`, `email`, `passwordHash`, `createdAt` (+ relations: `subscription`, `sessions`, `watchHistory`).
- **Subscription**: `id`, `userId (unique)`, `planId` → `Plan`.
- **Plan**: `id`, `type (FREE/BASIC/PREMIUM/ULTRA_PREMIUM)`, `maxDevices`.
- **Session**: `id`, `userId`, `deviceId` (unique per user), `deviceName?`, `refreshTokenHash`, `isRevoked`, `expiresAt`, `createdAt`, `lastUsedAt?`.
- **Content**: Metadata + `contentType`, `isActive`, relations to `Genre`, `ContentAccess`, `WatchHistory`.
- **ContentAccess**: `contentId`, `planId`, `videoQuality`, unique per `(contentId, planId)`.
- **WatchHistory**: `(userId, contentId)` unique, progress tracking.

### Database Diagram

![Database ER Diagram](docs/images/er.png)

This ER diagram visualizes the core entities and relations:

- `User` ↔ `Subscription` (1–1) via `userId`.
- `User` ↔ `Session` (1–n) with unique `(userId, deviceId)`.
- `Plan` ↔ `Subscription` (1–n) and ↔ `ContentAccess` (1–n).
- `Content` ↔ `ContentGenre` (1–n) ↔ `Genre` (1–n) for tagging.
- `Content` ↔ `ContentAccess` (1–n) for plan-aware availability and `videoQuality`.
- `User` ↔ `WatchHistory` (1–n) ↔ `Content` (1–n) for viewing progress.

Note: Save the provided diagram image to `docs/images/db-diagram.png` to render it in this document.

## Auth Flow & Screen Limits

### Login

1. Validate credentials; fetch user.
2. Load user subscription and plan; read active sessions count.
3. If `activeSessions >= plan.maxDevices`:
    - If no `logoutStrategy` provided → return `DEVICE_LIMIT_REACHED` with options: `LOGOUT_ALL` or `LOGOUT_LEAST_RECENT`.
    - If provided, apply:
        - `LOGOUT_LEAST_RECENT`: revoke least recent session (DB update).
        - `LOGOUT_ALL`: revoke all sessions.
4. Create a new `Session`:
    - `refreshTokenHash = bcrypt(hash(randomBytes(32)))` (refresh token never stored in plain).
    - `expiresAt = now + 7 days`.
5. Issue Access Token (JWT) with `{ userId, deviceId, sessionId }`, exp ~15m.
6. Return Access Token; set/return Refresh Token depending on `deviceType`:
    - `WEB`: httpOnly cookie (`/api/auth/refresh`).
    - `ANDROID/IOS`: in response body (client stores securely).

### Access Token Verification (authMiddleware)

- Verify JWT → check Redis for `session:{sessionId}`; on miss, fetch DB and cache with TTL.
- Reject if revoked or expired; update `lastUsedAt` on valid session.

### Refresh Flow (Token Rotation)

1. Client calls `/api/auth/refresh` with `deviceType` and a valid refresh token.
2. Middleware verifies:
    - Extract `sessionId` from Access Token (ignore expiry).
    - Get session from DB; verify not revoked/expired.
    - Compare provided refresh token to `refreshTokenHash` via bcrypt.
3. Controller:
    - Issue new Access Token (short-lived).
    - Generate new refresh token; **rotate** by updating `refreshTokenHash` in DB.
    - Return/set refreshed tokens based on `deviceType`.

### Logout

- **Single Device**: `/api/auth/logout` → revoke this `sessionId`; delete Redis key `session:{sessionId}`.
- **Global Logout**: `/api/auth/logout-all` → revoke all active sessions for user; delete all related Redis session keys.

## Redis Strategy

- **Keys**:
    - `session:{sessionId}`: session snapshot (TTL ~ 15m to match access token).
    - `user:subscription:{userId}`: cached subscription (TTL ~ 15m).
    - `content:plan:{planId}` and per-type/genre variants: cached content lists (TTL ~ 24h).
- **Invalidation**:
    - On subscription update: delete `user:subscription:{userId}`.
    - On logout/logout-all: delete `session:{sessionId}` keys.

## Security Implementation

- **JWT**: HS256; payload minimal and device-aware; short expiry; verify & handle common errors.
- **Refresh Tokens**: 32-byte hex, stored only as bcrypt hash; rotated each refresh.
- **Reuse Prevention**: Rotation invalidates old refresh token (hash mismatch on reuse → 401).
- **Helmet**: secure headers.
- **Rate Limiting**:
    - Global: 15m window, 1000 requests.
    - Auth: 15m window, max 5 login attempts.
    - Content: 1m window, 60 requests.

## Scalability Considerations

- Stateless Access Tokens; session reads optimized via Redis.
- Horizontal scaling friendly: Redis central store, DB transactional guarantees.
- Cache TTLs tuned for freshness vs load; invalidation on writes ensures correctness.

## Open Questions (for product/infra alignment)

- Subscription tiers and `maxDevices` values (current: FREE/BASIC/PREMIUM/ULTRA_PREMIUM).
- Preferred DB (current implementation: PostgreSQL). MongoDB variant would require schema adjustments and service changes.
- Token signing algorithm policies (HS256 vs RS256) and key management.

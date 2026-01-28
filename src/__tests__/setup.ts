import { beforeAll, afterAll, vi } from "vitest";

// Set up environment variables before tests
beforeAll(() => {
    process.env.JWT_ACCESS_TOKEN_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_TOKEN_SECRET = "test-refresh-secret";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.NODE_ENV = "test";
});

// Clean up after all tests
afterAll(() => {
    vi.clearAllMocks();
});

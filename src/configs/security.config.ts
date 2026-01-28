import helmet from "helmet";
import { globalLimiter } from "../middlewares/limiters.middleware";
import { Express } from "express";

export function setupSecurityConfigs(app: Express): void {
    // Additional security configurations can be added here in the future
    app.use(globalLimiter);
    app.use(helmet());
}

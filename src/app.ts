import express from "express";
import bodyParser from "body-parser";
import { errorHandler } from "./utils/errorHandler";
import authRoutes from "./routes/auth.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import contentRoutes from "./routes/content.routes";
import cookieParser from "cookie-parser";
import { setupSecurityConfigs } from "./configs/security.config";

const app = express();

setupSecurityConfigs(app);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/content", contentRoutes);

app.use(errorHandler);

export { app };

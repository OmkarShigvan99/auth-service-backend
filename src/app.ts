import express from "express";
import bodyParser from "body-parser";
import { errorHandler } from "./utils/errorHandler";
import authRoutes from "./routes/auth.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import cookieParser from "cookie-parser";
const app = express();

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/api/auth", authRoutes);
app.use("/api/subscription", subscriptionRoutes);

app.use(errorHandler);

export { app };

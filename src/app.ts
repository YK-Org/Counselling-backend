import express from "express";
import cors from "cors";
import routes from "./routes";
import dotenv from "dotenv";
import MiddlewareService from "./middleware/index";
import { apiLimiter } from "./middleware/rateLimiter";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/v1", apiLimiter);
app.use(MiddlewareService.checkAuthentication);
app.use("/api/v1", routes);

export default app;

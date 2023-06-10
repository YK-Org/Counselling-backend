import express from "express";
import cors from "cors";
import routes from "./routes";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json()).use(cors()).use("/api/v1", routes);

export default app;

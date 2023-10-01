import app from "./app";
import mongoose from "mongoose";
import { initialize } from "./socket";
import { v2 as cloudinary } from "cloudinary";

const { MONGODB_URL = "", PORT, CLOUD_NAME, API_KEY, API_SECRET } = process.env;
try {
  mongoose.connect(MONGODB_URL, {});
} catch (error) {
  console.log("tfty", error);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

const port = PORT || 3000;
const server = app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

initialize(server);

import app from "./app";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

const { MONGODB_URL = "", PORT, CLOUD_NAME, API_KEY, API_SECRET } = process.env;
mongoose.connect(MONGODB_URL, {});

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

const port = PORT || 3000;
app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

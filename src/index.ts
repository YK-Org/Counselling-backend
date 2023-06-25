import app from "./app";
import mongoose from "mongoose";
import { initialize } from "./socket";

const { MONGODB_URL = "", PORT } = process.env;
try {
  mongoose.connect(MONGODB_URL, {});
} catch (error) {
  console.log("tfty", error);
}

const port = PORT || 3000;
const server = app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

initialize(server);

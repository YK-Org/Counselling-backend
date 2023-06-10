import app from "./app";
import mongoose from "mongoose";

const { MONGODB_URL = "", PORT } = process.env;
console.log("MONGODB_URL", MONGODB_URL);
try {
  mongoose.connect(MONGODB_URL, {});
} catch (error) {
  console.log("tfty", error);
}

const port = PORT || 3000;
app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

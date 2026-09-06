import app from "./app";
import prisma from "./prisma/client";
import { initialize } from "./socket";

const { PORT } = process.env;


const port = PORT || 3000;

const start = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to Postgres");
  } catch (error) {
    // A failed DB connection is fatal — fail fast instead of serving requests
    // against a disconnected database.
    console.error("Failed to connect to Postgres:", error);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
  });

  initialize(server);
};

start();

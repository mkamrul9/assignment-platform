import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.info(`ReviewDock API listening on http://localhost:${env.PORT}`);
});

server.on("error", (error) => {
  console.error("Unable to start the API:", error.message);
  process.exit(1);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error("Unable to close the API:", error.message);
      process.exitCode = 1;
    }
  });

  setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10_000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

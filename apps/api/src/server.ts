import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  console.info(`ReviewDock API listening on http://localhost:${env.PORT}`);
});

server.on("error", (error) => {
  console.error("Unable to start the API:", error.message);
  process.exit(1);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  // Stop accepting requests first; drain handlers before closing their database pool.
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10_000).unref();

  server.close((error) => {
    void (async () => {
      try {
        if (error) throw error;
        await prisma.$disconnect();
      } catch (shutdownError) {
        console.error(
          "Unable to close the API cleanly:",
          shutdownError instanceof Error ? shutdownError.message : "Unknown error",
        );
        process.exitCode = 1;
      } finally {
        clearTimeout(deadline);
      }
    })();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookie = require("cookie");
const admin = require("./firebase/index");
const config = require("./config");
const { runWorkers } = require("./mediasoup/workerManager");
const socketHandlers = require("./socket/handlers");

const app = express();
const server = http.createServer(app);

// ── HTTP middleware ───────────────────────────────────────────────────────────
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(express.static("public"));

// Basic health check endpoint
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

(async () => {
  try {
    await runWorkers();

    // Auth middleware — always calls next() exactly once.
    // Empty string / missing token = guest (socket.user = null).
    io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      const rawCookies = socket.handshake.headers.cookie || "";
      const cookies = cookie.parse(rawCookies);

      console.log({passcode: cookies?.passcode})
      if (!token) {
        socket.user = null;
        socket.passcode = cookies?.passcode ?? null;
        return next();
      }

      try {
        const decoded = await admin.auth().verifyIdToken(token);
        socket.user = { ...decoded, passcode: cookies?.passcode ?? null };
      } catch {
        // Invalid or expired token — treat as guest, still allow through.
        // The room-level auth in roomManager will reject unauthorised users.
        socket.user = null;
        socket.passcode = cookies?.passcode ?? null;
      }
      return next();
    });

    io.on("connection", (socket) => {
      console.log(`[socket] Client connected: ${socket.id}`);
      socketHandlers(io, socket);
    });

    server.listen(config.port, () => {
      console.log(`Server listening on port ${config.port} [env:${config.nodeEnv}]`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
})();

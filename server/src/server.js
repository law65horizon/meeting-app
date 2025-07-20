const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookie = require("cookie")
const admin = require("./firebase/index");

const config = require("./config");
const { runWorkers } = require("./mediasoup/workerManager");
const socketHandlers = require("./socket/handlers");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.static("public"));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
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
      const cookies = cookie.parse(socket.handshake.headers.cookie || '')
      console.log({cookies: cookies?.passcode})
      if (!token) {
        socket.user = null;
        return next();
      }
      try {
        socket.user = {...await admin.auth().verifyIdToken(token), passcode: cookies?.passcode}
      } catch {
        // Invalid or expired token — treat as guest, still allow in
        socket.user = null;
      }
      return next(); // ← explicit return so next() is called exactly once
    });

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);
      socketHandlers(socket);
    });

    server.listen(config.port, () => {
      console.log(`Server listening on port ${config.port} [env:${config.nodeEnv}]`);
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
})();
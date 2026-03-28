const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const { isDbReady } = require("./config/db");
const routers = require("./routers");
const { subscribeToSignals, subscribeToPrices } = require("./services/redis");
const setupSocketIO = require("./services/socketio");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Make io accessible to routers via req.app
app.set("io", io);

// Wire up Socket.IO with Redis pub/sub bridging
setupSocketIO(io, { subscribeToSignals, subscribeToPrices });

// Middleware
app.use(cors());
app.use(express.json());

// Gate API routes behind DB readiness – return 503 until MongoDB is connected
app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  if (!isDbReady()) {
    return res.status(503).json({ error: "Service starting up, please retry" });
  }
  next();
});

// Routes
app.use("/api", routers);

// Health check (always available)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", db: isDbReady() ? "connected" : "connecting" });
});

// Start listening immediately, then connect to MongoDB in the background
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectDB();

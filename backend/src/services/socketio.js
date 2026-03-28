const Alert = require("../models/alert.model");
const Trade = require("../models/trade.model");

/**
 * Set up Socket.IO event handling with Redis pub/sub integration.
 *
 * @param {import("socket.io").Server} io - Socket.IO server instance
 * @param {Object} redisSubscriber - Redis subscriber helpers from redis.js
 *   Expected shape: { subscribeToSignals, subscribeToPrices }
 */
const setupSocketIO = (io, { subscribeToSignals, subscribeToPrices }) => {
  // ── Redis → Socket.IO bridges ──────────────────────────────────────

  // Forward new signals to clients watching the relevant symbol
  subscribeToSignals((channel, signal) => {
    const symbol = channel.replace("signals:", "");
    const room = `watch:${symbol}`;

    // Emit to everyone in the symbol room
    io.to(room).emit("signal:new", signal);

    // If the signal meets the alert threshold it will already have a
    // corresponding Alert document created by the analysis pipeline.
    // We forward the approval request to the room so the UI can act.
    if (signal.type !== "hold" && signal.alertId) {
      io.to(room).emit("alert:approval", {
        alertId: signal.alertId,
        symbol: signal.symbol,
        type: signal.type,
        price: signal.price,
        strength: signal.strength,
        message: signal.message || `${signal.type.toUpperCase()} signal for ${signal.symbol}`,
      });
    }
  });

  // Forward price updates to clients watching the relevant symbol
  subscribeToPrices((channel, data) => {
    const symbol = channel.replace("prices:", "");
    io.to(`watch:${symbol}`).emit("prices:update", data);
  });

  // ── Client connection handling ─────────────────────────────────────

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a symbol room to receive updates for that symbol
    socket.on("watch:subscribe", (symbol) => {
      if (!symbol || typeof symbol !== "string") return;
      const room = `watch:${symbol.toUpperCase()}`;
      socket.join(room);
      console.log(`${socket.id} joined ${room}`);
    });

    // Leave a symbol room
    socket.on("watch:unsubscribe", (symbol) => {
      if (!symbol || typeof symbol !== "string") return;
      const room = `watch:${symbol.toUpperCase()}`;
      socket.leave(room);
      console.log(`${socket.id} left ${room}`);
    });

    // Handle alert approval / rejection from the client
    socket.on("alert:respond", async (data) => {
      try {
        const { alertId, action } = data; // action: "approved" | "rejected"

        if (!alertId || !["approved", "rejected"].includes(action)) {
          return socket.emit("error", { message: "Invalid alert response" });
        }

        const alert = await Alert.findByIdAndUpdate(
          alertId,
          { status: action, respondedAt: new Date() },
          { new: true }
        );

        if (!alert) {
          return socket.emit("error", { message: "Alert not found" });
        }

        // If approved, create a pending trade record
        if (action === "approved") {
          const trade = await Trade.create({
            alert: alert._id,
            signal: alert.signal,
            symbol: alert.symbol,
            side: alert.type,
            price: alert.price,
            status: "pending",
          });

          io.to(`watch:${alert.symbol}`).emit("trade:executed", trade);
        }
      } catch (err) {
        console.error("alert:respond error:", err.message);
        socket.emit("error", { message: "Failed to process alert response" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Client disconnected: ${socket.id} (${reason})`);
    });
  });
};

module.exports = setupSocketIO;

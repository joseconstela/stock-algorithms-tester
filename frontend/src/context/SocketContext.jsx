import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./socketContextDef.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("alert:approval", (alert) => {
      setPendingAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    });

    socket.on("alert:responded", (data) => {
      setPendingAlerts((prev) => prev.filter((a) => a.id !== data.id));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const respondToAlert = useCallback(async (alertId, action) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to respond to alert");
      const data = await res.json();
      setPendingAlerts((prev) => prev.filter((a) => a.id !== alertId));
      return data;
    } catch (err) {
      console.error("Error responding to alert:", err);
      throw err;
    }
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    pendingAlerts,
    pendingAlertsCount: pendingAlerts.length,
    respondToAlert,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

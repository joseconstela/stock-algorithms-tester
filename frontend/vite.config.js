import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Suppress noisy ECONNREFUSED proxy errors during startup race
const silenceProxyError = (err, _req, _res) => {
  if (err.code === "ECONNREFUSED") return;
  console.error("[vite] proxy error:", err.message);
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure: (proxy) => proxy.on("error", silenceProxyError),
      },
      "/socket.io": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => proxy.on("error", silenceProxyError),
      },
    },
  },
});

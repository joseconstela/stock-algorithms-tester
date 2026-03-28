import { useState, useEffect, useCallback } from "react";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemContent from "@mui/joy/ListItemContent";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import LinearProgress from "@mui/joy/LinearProgress";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import { useSocket } from "../useSocket";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SignalFeed() {
  const { socket } = useSocket();
  const [signals, setSignals] = useState([]);

  const handleNewSignal = useCallback((signal) => {
    setSignals((prev) => [signal, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("signal:new", handleNewSignal);
    return () => {
      socket.off("signal:new", handleNewSignal);
    };
  }, [socket, handleNewSignal]);

  if (signals.length === 0) {
    return (
      <Sheet variant="outlined" sx={{ borderRadius: "sm", p: 3 }}>
        <Typography level="title-md" sx={{ mb: 1 }}>
          Live Signal Feed
        </Typography>
        <Typography level="body-sm" color="neutral">
          Waiting for signals... They will appear here in real-time.
        </Typography>
      </Sheet>
    );
  }

  return (
    <Sheet variant="outlined" sx={{ borderRadius: "sm", p: 2 }}>
      <Typography level="title-md" sx={{ mb: 1, px: 1 }}>
        Live Signal Feed
      </Typography>
      <List
        size="sm"
        sx={{
          "--ListItem-radius": "6px",
          "--List-gap": "2px",
          maxHeight: 400,
          overflow: "auto",
        }}
      >
        {signals.map((sig, i) => (
          <ListItem
            key={sig.id || i}
            sx={{
              animation: i === 0 ? "fadeIn 0.3s ease-in" : undefined,
              "@keyframes fadeIn": {
                from: { opacity: 0, transform: "translateY(-8px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            <ListItemContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Typography level="title-sm" sx={{ fontWeight: 700, minWidth: 70 }}>
                  {sig.symbol}
                </Typography>
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    sig.type === "buy"
                      ? "success"
                      : sig.type === "sell"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {sig.type?.toUpperCase()}
                </Chip>
                <Box sx={{ flexGrow: 1, minWidth: 60, maxWidth: 120 }}>
                  <LinearProgress
                    determinate
                    value={sig.strength ?? 0}
                    color={
                      sig.type === "buy"
                        ? "success"
                        : sig.type === "sell"
                        ? "danger"
                        : "neutral"
                    }
                    size="sm"
                  />
                </Box>
                <Typography level="body-xs" color="neutral">
                  {sig.strategy}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  {sig.timeframe}
                </Typography>
                <Typography level="body-xs" color="neutral" sx={{ ml: "auto" }}>
                  {timeAgo(sig.timestamp || sig.createdAt)}
                </Typography>
              </Box>
            </ListItemContent>
          </ListItem>
        ))}
      </List>
    </Sheet>
  );
}

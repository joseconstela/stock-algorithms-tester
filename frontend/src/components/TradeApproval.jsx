import { useState, useEffect, useCallback } from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import LinearProgress from "@mui/joy/LinearProgress";
import { useSocket } from "../useSocket";

function CountdownTimer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        onExpire?.();
        return;
      }
      const secs = Math.floor(diff / 1000);
      const mins = Math.floor(secs / 60);
      setRemaining(mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <Typography level="body-xs" color="warning">
      {remaining}
    </Typography>
  );
}

function ApprovalCard({ alert, onRespond, onDismiss }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await onRespond(alert.id, action);
    } catch {
      setLoading(false);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        width: 340,
        animation: "slideIn 0.3s ease-out",
        "@keyframes slideIn": {
          from: { opacity: 0, transform: "translateX(20px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography level="title-md" sx={{ fontWeight: 700 }}>
          {alert.symbol}
        </Typography>
        <Chip
          size="sm"
          variant="solid"
          color={alert.type === "buy" ? "success" : "danger"}
        >
          {alert.type?.toUpperCase()}
        </Chip>
      </Box>

      {alert.price && (
        <Typography level="body-sm">
          Price: {alert.price}
        </Typography>
      )}

      {alert.strength != null && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography level="body-xs">Strength:</Typography>
          <LinearProgress
            determinate
            value={alert.strength}
            size="sm"
            sx={{ flexGrow: 1 }}
            color={alert.type === "buy" ? "success" : "danger"}
          />
          <Typography level="body-xs">{alert.strength}%</Typography>
        </Box>
      )}

      {alert.message && (
        <Typography level="body-sm" color="neutral">
          {alert.message}
        </Typography>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <CountdownTimer expiresAt={alert.expiresAt} onExpire={onDismiss} />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="sm"
            color="danger"
            variant="soft"
            loading={loading}
            onClick={() => handleAction("reject")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            color="success"
            variant="solid"
            loading={loading}
            onClick={() => handleAction("approve")}
          >
            Approve
          </Button>
        </Box>
      </Box>
    </Card>
  );
}

export default function TradeApproval() {
  const { pendingAlerts, respondToAlert } = useSocket();

  const handleDismiss = useCallback(
    (alertId) => {
      // Auto-dismiss expired alerts by rejecting them
      respondToAlert(alertId, "reject").catch(() => {});
    },
    [respondToAlert]
  );

  if (pendingAlerts.length === 0) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        maxHeight: "80vh",
        overflow: "auto",
      }}
    >
      {pendingAlerts.map((alert) => (
        <ApprovalCard
          key={alert.id}
          alert={alert}
          onRespond={respondToAlert}
          onDismiss={() => handleDismiss(alert.id)}
        />
      ))}
    </Box>
  );
}

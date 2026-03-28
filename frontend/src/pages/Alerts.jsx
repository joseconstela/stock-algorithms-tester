import { useState, useEffect } from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import LinearProgress from "@mui/joy/LinearProgress";
import CircularProgress from "@mui/joy/CircularProgress";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../useSocket";

function formatTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function computeRemaining(expiresAt) {
  if (!expiresAt) return "—";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
}

function CountdownTimer({ expiresAt }) {
  const [remaining, setRemaining] = useState(() => computeRemaining(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      setRemaining(computeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <Typography level="body-sm" color="warning" sx={{ fontFamily: "monospace" }}>
      {remaining}
    </Typography>
  );
}

function PendingAlertCard({ alert, onRespond }) {
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
      color="warning"
      sx={{ flex: "1 1 300px", maxWidth: 400 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography level="title-lg" sx={{ fontWeight: 700 }}>
          {alert.symbol}
        </Typography>
        <Chip
          variant="solid"
          color={alert.type === "buy" ? "success" : "danger"}
        >
          {alert.type?.toUpperCase()}
        </Chip>
      </Box>

      {alert.price != null && (
        <Typography level="body-md">
          Price: <strong>{Number(alert.price).toFixed(2)}</strong>
        </Typography>
      )}

      {alert.strength != null && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography level="body-sm">Strength:</Typography>
          <LinearProgress
            determinate
            value={alert.strength}
            size="sm"
            sx={{ flexGrow: 1 }}
            color={alert.type === "buy" ? "success" : "danger"}
          />
          <Typography level="body-sm">{alert.strength}%</Typography>
        </Box>
      )}

      {alert.message && (
        <Typography level="body-sm" color="neutral">
          {alert.message}
        </Typography>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
        <CountdownTimer expiresAt={alert.expiresAt} />
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

const PAGE_SIZE = 20;

export default function Alerts() {
  const { pendingAlerts, respondToAlert } = useSocket();
  const [offset, setOffset] = useState(0);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  }).toString();

  const { data, loading, error, refetch } = useApi(`/api/alerts?${params}`);

  const alerts = Array.isArray(data) ? data : data?.data ?? [];
  const total = data?.total ?? alerts.length;

  const handleRespond = async (id, action) => {
    await respondToAlert(id, action);
    refetch();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography level="h3">Alerts</Typography>

      {/* Pending alerts */}
      {pendingAlerts.length > 0 && (
        <Box>
          <Typography level="title-md" sx={{ mb: 1 }}>
            Pending Approval ({pendingAlerts.length})
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {pendingAlerts.map((alert) => (
              <PendingAlertCard
                key={alert.id}
                alert={alert}
                onRespond={handleRespond}
              />
            ))}
          </Box>
        </Box>
      )}

      {error && (
        <Typography level="body-sm" color="danger">
          Error: {error}
        </Typography>
      )}

      {/* Alert history */}
      <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
        <Typography level="title-md" sx={{ p: 2, pb: 1 }}>
          Alert History
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : alerts.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ p: 3 }}>
            No alerts recorded yet.
          </Typography>
        ) : (
          <Table
            hoverRow
            size="sm"
            sx={{ "--TableCell-headBackground": "transparent" }}
          >
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Price</th>
                <th style={{ width: 120 }}>Strength</th>
                <th>Status</th>
                <th>Response Time</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={alert.id || i}>
                  <td>{formatTime(alert.timestamp || alert.createdAt)}</td>
                  <td>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {alert.symbol}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        alert.type === "buy"
                          ? "success"
                          : alert.type === "sell"
                          ? "danger"
                          : "neutral"
                      }
                    >
                      {alert.type?.toUpperCase()}
                    </Chip>
                  </td>
                  <td>
                    {alert.price != null ? Number(alert.price).toFixed(2) : "—"}
                  </td>
                  <td>
                    <LinearProgress
                      determinate
                      value={alert.strength ?? 0}
                      size="sm"
                      color={
                        alert.type === "buy"
                          ? "success"
                          : alert.type === "sell"
                          ? "danger"
                          : "neutral"
                      }
                    />
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        alert.status === "approved"
                          ? "success"
                          : alert.status === "rejected"
                          ? "danger"
                          : alert.status === "expired"
                          ? "neutral"
                          : "warning"
                      }
                    >
                      {alert.status ?? "—"}
                    </Chip>
                  </td>
                  <td>
                    {alert.respondedAt
                      ? `${((new Date(alert.respondedAt) - new Date(alert.createdAt)) / 1000).toFixed(0)}s`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Sheet>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
          <Button
            size="sm"
            variant="outlined"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Typography level="body-sm" sx={{ alignSelf: "center" }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </Typography>
          <Button
            size="sm"
            variant="outlined"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
          </Button>
        </Box>
      )}
    </Box>
  );
}

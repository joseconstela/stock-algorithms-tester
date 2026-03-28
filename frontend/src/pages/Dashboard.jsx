import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Chip from "@mui/joy/Chip";
import Switch from "@mui/joy/Switch";
import CircularProgress from "@mui/joy/CircularProgress";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../useSocket";
import SignalFeed from "../components/SignalFeed";

function SummaryCard({ title, value, color, loading }) {
  return (
    <Card variant="outlined" sx={{ flex: "1 1 200px", minWidth: 160 }}>
      <Typography level="body-sm" color="neutral">
        {title}
      </Typography>
      {loading ? (
        <CircularProgress size="sm" />
      ) : (
        <Typography level="h3" color={color}>
          {value ?? "—"}
        </Typography>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { pendingAlertsCount } = useSocket();
  const { data: activeSignals, loading: sigLoading } = useApi("/api/signals/active");
  const { data: watchlist, loading: wlLoading } = useApi("/api/watchlist");
  const { data: trades, loading: trLoading } = useApi("/api/trades?limit=1&offset=0");

  const activeSignalCount = useMemo(() => {
    if (!activeSignals) return null;
    return Array.isArray(activeSignals) ? activeSignals.length : activeSignals.total ?? 0;
  }, [activeSignals]);

  const watchlistCount = useMemo(() => {
    if (!watchlist) return null;
    return Array.isArray(watchlist) ? watchlist.length : watchlist.total ?? 0;
  }, [watchlist]);

  const tradeCount = useMemo(() => {
    if (!trades) return null;
    if (trades.total != null) return trades.total;
    if (Array.isArray(trades)) return trades.length;
    return 0;
  }, [trades]);

  const watchlistItems = Array.isArray(watchlist)
    ? watchlist
    : watchlist?.data ?? [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography level="h3">Dashboard</Typography>

      {/* Summary cards */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <SummaryCard
          title="Active Signals"
          value={activeSignalCount}
          color="primary"
          loading={sigLoading}
        />
        <SummaryCard
          title="Pending Alerts"
          value={pendingAlertsCount}
          color="warning"
          loading={false}
        />
        <SummaryCard
          title="Total Trades"
          value={tradeCount}
          color="success"
          loading={trLoading}
        />
        <SummaryCard
          title="Watchlist Items"
          value={watchlistCount}
          color="neutral"
          loading={wlLoading}
        />
      </Box>

      {/* Live signal feed */}
      <SignalFeed />

      {/* Watchlist table */}
      <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
        <Typography level="title-md" sx={{ p: 2, pb: 1 }}>
          Watchlist
        </Typography>
        {wlLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        ) : watchlistItems.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ p: 2 }}>
            No symbols in watchlist. Add some in Settings.
          </Typography>
        ) : (
          <Table
            hoverRow
            sx={{
              "& thead th": { bgcolor: "transparent" },
              "--TableCell-headBackground": "transparent",
            }}
          >
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Active</th>
                <th>Timeframes</th>
                <th>Alert Threshold</th>
              </tr>
            </thead>
            <tbody>
              {watchlistItems.map((item) => (
                <tr
                  key={item.symbol}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/ticker/${item.symbol}`)}
                >
                  <td>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {item.symbol}
                    </Typography>
                  </td>
                  <td>
                    <Switch
                      size="sm"
                      checked={item.active !== false}
                      readOnly
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {(item.timeframes || []).map((tf) => (
                        <Chip key={tf} size="sm" variant="outlined">
                          {tf}
                        </Chip>
                      ))}
                    </Box>
                  </td>
                  <td>{item.alertThreshold ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Sheet>
    </Box>
  );
}

import { useState, useMemo } from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Chip from "@mui/joy/Chip";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 20;

function formatTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export default function Trades() {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (symbol) p.set("symbol", symbol);
    if (side) p.set("side", side);
    if (status) p.set("status", status);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(offset));
    return p.toString();
  }, [symbol, side, status, offset]);

  const { data, loading, error } = useApi(`/api/trades?${params}`);

  const trades = Array.isArray(data) ? data : data?.data ?? [];
  const total = data?.total ?? trades.length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography level="h3">Trades</Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Box>
          <Typography level="body-xs" sx={{ mb: 0.5 }}>
            Symbol
          </Typography>
          <Input
            size="sm"
            placeholder="e.g. BTCUSDT"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              setOffset(0);
            }}
          />
        </Box>
        <Box>
          <Typography level="body-xs" sx={{ mb: 0.5 }}>
            Side
          </Typography>
          <Select
            size="sm"
            value={side}
            onChange={(_, v) => {
              setSide(v ?? "");
              setOffset(0);
            }}
            placeholder="All"
            sx={{ minWidth: 100 }}
          >
            <Option value="">All</Option>
            <Option value="buy">Buy</Option>
            <Option value="sell">Sell</Option>
          </Select>
        </Box>
        <Box>
          <Typography level="body-xs" sx={{ mb: 0.5 }}>
            Status
          </Typography>
          <Select
            size="sm"
            value={status}
            onChange={(_, v) => {
              setStatus(v ?? "");
              setOffset(0);
            }}
            placeholder="All"
            sx={{ minWidth: 100 }}
          >
            <Option value="">All</Option>
            <Option value="pending">Pending</Option>
            <Option value="filled">Filled</Option>
            <Option value="cancelled">Cancelled</Option>
            <Option value="failed">Failed</Option>
          </Select>
        </Box>
      </Box>

      {error && (
        <Typography level="body-sm" color="danger">
          Error: {error}
        </Typography>
      )}

      {/* Table */}
      <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : trades.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ p: 3 }}>
            No trades found.
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
                <th>Side</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Broker</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, i) => (
                <tr key={trade.id || i}>
                  <td>{formatTime(trade.timestamp || trade.createdAt)}</td>
                  <td>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {trade.symbol}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={trade.side === "buy" ? "success" : "danger"}
                    >
                      {trade.side?.toUpperCase()}
                    </Chip>
                  </td>
                  <td>
                    {trade.price != null ? Number(trade.price).toFixed(2) : "—"}
                  </td>
                  <td>{trade.quantity ?? "—"}</td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        trade.status === "filled"
                          ? "success"
                          : trade.status === "failed"
                          ? "danger"
                          : trade.status === "cancelled"
                          ? "neutral"
                          : "warning"
                      }
                    >
                      {trade.status ?? "—"}
                    </Chip>
                  </td>
                  <td>{trade.broker ?? "—"}</td>
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

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
import LinearProgress from "@mui/joy/LinearProgress";
import CircularProgress from "@mui/joy/CircularProgress";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 20;

function formatTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

export default function Signals() {
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [strategy, setStrategy] = useState("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const { data: strategiesData } = useApi("/api/strategies");
  const strategies = Array.isArray(strategiesData)
    ? strategiesData
    : strategiesData?.data ?? [];

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (symbol) p.set("symbol", symbol);
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    if (strategy) p.set("strategy", strategy);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(offset));
    return p.toString();
  }, [symbol, type, status, strategy, offset]);

  const { data, loading, error } = useApi(`/api/signals?${params}`);

  const signals = Array.isArray(data) ? data : data?.data ?? [];
  const total = data?.total ?? signals.length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography level="h3">Signals</Typography>

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
            Type
          </Typography>
          <Select
            size="sm"
            value={type}
            onChange={(_, v) => {
              setType(v ?? "");
              setOffset(0);
            }}
            placeholder="All"
            sx={{ minWidth: 100 }}
          >
            <Option value="">All</Option>
            <Option value="buy">Buy</Option>
            <Option value="sell">Sell</Option>
            <Option value="hold">Hold</Option>
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
            <Option value="active">Active</Option>
            <Option value="expired">Expired</Option>
            <Option value="executed">Executed</Option>
          </Select>
        </Box>
        <Box>
          <Typography level="body-xs" sx={{ mb: 0.5 }}>
            Strategy
          </Typography>
          <Select
            size="sm"
            value={strategy}
            onChange={(_, v) => {
              setStrategy(v ?? "");
              setOffset(0);
            }}
            placeholder="All"
            sx={{ minWidth: 140 }}
          >
            <Option value="">All</Option>
            {strategies.map((s) => (
              <Option key={s.name} value={s.name}>
                {s.name}
              </Option>
            ))}
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
        ) : signals.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ p: 3 }}>
            No signals found.
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
                <th style={{ width: 120 }}>Strength</th>
                <th>Strategy</th>
                <th>Timeframe</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((sig, i) => (
                <>
                  <tr
                    key={sig.id || i}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      setExpanded(expanded === (sig.id || i) ? null : sig.id || i)
                    }
                  >
                    <td>{formatTime(sig.timestamp || sig.createdAt)}</td>
                    <td>
                      <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                        {sig.symbol}
                      </Typography>
                    </td>
                    <td>
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
                    </td>
                    <td>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress
                          determinate
                          value={sig.strength ?? 0}
                          size="sm"
                          sx={{ flexGrow: 1 }}
                          color={
                            sig.type === "buy"
                              ? "success"
                              : sig.type === "sell"
                              ? "danger"
                              : "neutral"
                          }
                        />
                        <Typography level="body-xs">{sig.strength ?? 0}</Typography>
                      </Box>
                    </td>
                    <td>{sig.strategy ?? "—"}</td>
                    <td>{sig.timeframe ?? "—"}</td>
                    <td>
                      <Chip size="sm" variant="outlined">
                        {sig.status ?? "—"}
                      </Chip>
                    </td>
                    <td>{sig.price != null ? Number(sig.price).toFixed(2) : "—"}</td>
                  </tr>
                  {expanded === (sig.id || i) && sig.indicators && (
                    <tr key={`${sig.id || i}-detail`}>
                      <td colSpan={8}>
                        <Sheet variant="soft" sx={{ p: 2, borderRadius: "sm" }}>
                          <Typography level="title-sm" sx={{ mb: 1 }}>
                            Indicator Snapshot
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              gap: 2,
                              flexWrap: "wrap",
                            }}
                          >
                            {Object.entries(sig.indicators).map(([k, v]) => (
                              <Box key={k}>
                                <Typography level="body-xs" color="neutral">
                                  {k}
                                </Typography>
                                <Typography level="body-sm">
                                  {typeof v === "number" ? v.toFixed(4) : JSON.stringify(v)}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Sheet>
                      </td>
                    </tr>
                  )}
                </>
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

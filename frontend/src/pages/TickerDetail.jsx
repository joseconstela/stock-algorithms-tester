import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Button from "@mui/joy/Button";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import { useApi } from "../hooks/useApi";
import { useSocket } from "../useSocket";
import CandlestickChart from "../components/CandlestickChart";

const TIMEFRAMES = ["1m", "15m", "1h", "1d"];
const LIMIT_BY_TF = { "1m": 500, "15m": 200, "1h": 200, "1d": 500 };

function formatTime(dateStr) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString();
}

export default function TickerDetail() {
  const { symbol } = useParams();
  const { socket } = useSocket();
  const [timeframe, setTimeframe] = useState("1h");
  const [selectedStrategy, setSelectedStrategy] = useState("");

  const limit = LIMIT_BY_TF[timeframe] || 200;

  const { data: latestPrices, loading: priceLoading } = useApi(
    `/api/prices/${symbol}/latest`
  );
  const { data: priceData, loading: candlesLoading } = useApi(
    `/api/prices/${symbol}?timeframe=${timeframe}&limit=${limit}`
  );
  const { data: signalsData, loading: sigLoading } = useApi(
    `/api/signals?symbol=${symbol}&limit=50`
  );
  const { data: strategiesData } = useApi("/api/strategies");

  // Join/leave symbol room for live updates
  useEffect(() => {
    if (!socket) return;
    socket.emit("watch:subscribe", symbol);
    return () => {
      socket.emit("watch:unsubscribe", symbol);
    };
  }, [socket, symbol]);

  const availableStrategies = Array.isArray(strategiesData)
    ? strategiesData
    : strategiesData?.data ?? [];

  const candles = Array.isArray(priceData) ? priceData : priceData?.data ?? [];
  const allSignals = Array.isArray(signalsData)
    ? signalsData
    : signalsData?.data ?? [];

  // Filter signals by selected strategy
  const signals = useMemo(() => {
    if (!selectedStrategy) return allSignals;
    return allSignals.filter((s) => s.strategy === selectedStrategy);
  }, [allSignals, selectedStrategy]);

  // Derive current price from the latest candle in the selected timeframe
  const latestForTf = latestPrices?.[timeframe]?.latest ?? latestPrices?.[timeframe];
  const price = latestForTf?.close;

  // Find indicator values from the latest price doc that has them
  const indicatorSource = Object.values(latestPrices || {}).find(
    (p) => p?.indicators || p?.latest?.indicators
  );
  const indicators =
    indicatorSource?.indicators ?? indicatorSource?.latest?.indicators ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <Typography level="h3">{symbol}</Typography>
          {priceLoading ? (
            <CircularProgress size="sm" />
          ) : (
            price != null && (
              <Typography level="h4">{Number(price).toFixed(2)}</Typography>
            )
          )}
        </Box>

        {/* Timeframe selector */}
        <ToggleButtonGroup
          size="sm"
          value={timeframe}
          onChange={(_e, val) => val && setTimeframe(val)}
        >
          {TIMEFRAMES.map((tf) => (
            <Button key={tf} value={tf}>
              {tf}
            </Button>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Strategy selector above chart */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography level="body-sm" color="neutral">
          Strategy:
        </Typography>
        <Select
          size="sm"
          value={selectedStrategy}
          onChange={(_e, val) => setSelectedStrategy(val ?? "")}
          placeholder="All strategies"
          sx={{ minWidth: 160 }}
        >
          <Option value="">All strategies</Option>
          {availableStrategies.map((s) => (
            <Option key={s.name} value={s.name}>
              {s.name}
            </Option>
          ))}
        </Select>
      </Box>

      {/* Candlestick chart */}
      <Card variant="outlined" sx={{ p: 0, overflow: "hidden" }}>
        {candlesLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 400,
            }}
          >
            <CircularProgress />
          </Box>
        ) : candles.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 400,
            }}
          >
            <Typography level="body-lg" color="neutral">
              No candle data available for {timeframe}.
            </Typography>
          </Box>
        ) : (
          <CandlestickChart candles={candles} signals={signals} height={400} />
        )}
      </Card>

      {/* Indicator values */}
      <Box>
        <Typography level="title-md" sx={{ mb: 1 }}>
          Latest Indicators
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {indicators ? (
            Object.entries(indicators).map(([key, val]) => (
              <Card key={key} variant="soft" size="sm" sx={{ minWidth: 120 }}>
                <Typography level="body-xs" color="neutral">
                  {key.toUpperCase()}
                </Typography>
                <Typography level="title-md">
                  {typeof val === "number" ? val.toFixed(4) : JSON.stringify(val)}
                </Typography>
              </Card>
            ))
          ) : (
            <Typography level="body-sm" color="neutral">
              No indicator data available yet.
            </Typography>
          )}
        </Box>
      </Box>

      {/* Signal history */}
      <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
        <Typography level="title-md" sx={{ p: 2, pb: 1 }}>
          Signal History
        </Typography>
        {sigLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        ) : signals.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ p: 2 }}>
            No signals recorded for {symbol}.
          </Typography>
        ) : (
          <Table size="sm" sx={{ "--TableCell-headBackground": "transparent" }}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Strength</th>
                <th>Strategy</th>
                <th>Timeframe</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((sig, i) => (
                <tr key={sig._id || sig.id || i}>
                  <td>{formatTime(sig.timestamp || sig.createdAt)}</td>
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
                  <td>{sig.strength ?? "\u2014"}</td>
                  <td>
                    <Chip size="sm" variant="soft" color="primary">
                      {sig.strategy ?? "\u2014"}
                    </Chip>
                  </td>
                  <td>{sig.timeframe ?? "\u2014"}</td>
                  <td>
                    <Chip size="sm" variant="outlined">
                      {sig.status ?? "\u2014"}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Sheet>
    </Box>
  );
}

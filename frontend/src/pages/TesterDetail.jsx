import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import CircularProgress from "@mui/joy/CircularProgress";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Checkbox from "@mui/joy/Checkbox";
import LinearProgress from "@mui/joy/LinearProgress";
import { useApi } from "../hooks/useApi";
import CandlestickChart from "../components/CandlestickChart";

// ---------------------------------------------------------------------------
// Strategy colour palette
// ---------------------------------------------------------------------------

const STRATEGY_COLORS = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#22c55e", // green
  "#ef4444", // red
];

function strategyColor(name, names) {
  const idx = names.indexOf(name);
  if (idx >= 0) return STRATEGY_COLORS[idx % STRATEGY_COLORS.length];
  const hash = Math.abs(
    name.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
  );
  return STRATEGY_COLORS[hash % STRATEGY_COLORS.length];
}

// ---------------------------------------------------------------------------
// TesterDetail page – /tester/:executionId
// ---------------------------------------------------------------------------

export default function TesterDetail() {
  const { executionId } = useParams();
  const navigate = useNavigate();

  // Fetch execution + its results (without signals)
  const {
    data: execData,
    loading: execLoading,
    error: execError,
  } = useApi(`/api/backtest/executions/${executionId}`);

  const execution = execData?.execution;
  const results = useMemo(
    () => (Array.isArray(execData?.results) ? execData.results : []),
    [execData]
  );

  // Multi-select: set of checked result IDs
  const [checkedIds, setCheckedIds] = useState(new Set());

  // Chart filter state
  const [chartSymbol, setChartSymbol] = useState(null);
  const [chartTimeframe, setChartTimeframe] = useState(null);

  // Cache of fetched full results (id -> result with signals)
  const [fullResults, setFullResults] = useState({});
  const [fetchingResults, setFetchingResults] = useState(false);

  // Derive from checked
  const checkedResults = useMemo(
    () => results.filter((r) => checkedIds.has(r._id)),
    [results, checkedIds]
  );

  const availableChartSymbols = useMemo(
    () => [...new Set(checkedResults.map((r) => r.symbol))].sort(),
    [checkedResults]
  );

  useEffect(() => {
    if (
      availableChartSymbols.length > 0 &&
      !availableChartSymbols.includes(chartSymbol)
    ) {
      setChartSymbol(availableChartSymbols[0]);
    } else if (availableChartSymbols.length === 0) {
      setChartSymbol(null);
    }
  }, [availableChartSymbols, chartSymbol]);

  const symbolResults = useMemo(
    () => checkedResults.filter((r) => r.symbol === chartSymbol),
    [checkedResults, chartSymbol]
  );

  const availableTimeframes = useMemo(
    () => [...new Set(symbolResults.map((r) => r.timeframe))].sort(),
    [symbolResults]
  );

  useEffect(() => {
    if (
      availableTimeframes.length > 0 &&
      !availableTimeframes.includes(chartTimeframe)
    ) {
      setChartTimeframe(availableTimeframes[0]);
    } else if (availableTimeframes.length === 0) {
      setChartTimeframe(null);
    }
  }, [availableTimeframes, chartTimeframe]);

  const chartResults = useMemo(
    () => symbolResults.filter((r) => r.timeframe === chartTimeframe),
    [symbolResults, chartTimeframe]
  );

  const chartStrategyNames = useMemo(
    () => [...new Set(chartResults.map((r) => r.strategy))].sort(),
    [chartResults]
  );

  // Fetch full results (with signals) for chart results
  useEffect(() => {
    const idsToFetch = chartResults
      .map((r) => r._id)
      .filter((id) => !fullResults[id]);

    if (idsToFetch.length === 0) return;

    let cancelled = false;
    setFetchingResults(true);

    Promise.all(
      idsToFetch.map((id) =>
        fetch(`/api/backtest/results/${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )
    ).then((fetched) => {
      if (cancelled) return;
      setFullResults((prev) => {
        const next = { ...prev };
        fetched.forEach((r) => {
          if (r && r._id) next[r._id] = r;
        });
        return next;
      });
      setFetchingResults(false);
    });

    return () => {
      cancelled = true;
    };
  }, [chartResults, fullResults]);

  // Merge signals
  const mergedSignals = useMemo(() => {
    const all = [];
    for (const r of chartResults) {
      const full = fullResults[r._id];
      const sigs = full?.signals ?? [];
      for (const sig of sigs) {
        all.push({ ...sig, strategy: r.strategy });
      }
    }
    return all;
  }, [chartResults, fullResults]);

  // Price data
  const { data: priceData, loading: priceLoading } = useApi(
    chartSymbol && chartTimeframe
      ? `/api/prices/${chartSymbol}?timeframe=${chartTimeframe}&limit=1000`
      : null
  );

  const candles = useMemo(() => {
    const raw = Array.isArray(priceData) ? priceData : priceData?.data ?? [];
    return [...raw].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [priceData]);

  // Handlers
  const toggleChecked = useCallback((id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllChecked = useCallback(() => {
    setCheckedIds((prev) => {
      if (prev.size === results.length) return new Set();
      return new Set(results.map((r) => r._id));
    });
  }, [results]);

  const hasChart =
    chartSymbol && chartTimeframe && chartResults.length > 0;

  if (execLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (execError || !execution) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 3 }}>
        <Typography level="body-sm" color="danger">
          {execError || "Execution not found."}
        </Typography>
        <Button
          variant="plain"
          size="sm"
          onClick={() => navigate("/tester")}
          sx={{ alignSelf: "flex-start" }}
        >
          &larr; Back to executions
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Button
            variant="plain"
            size="sm"
            onClick={() => navigate("/tester")}
            sx={{ minWidth: 0, px: 1 }}
          >
            &larr; Back
          </Button>
          <Typography level="h3">Test Execution</Typography>
          <Chip
            size="sm"
            variant="soft"
            color={
              execution.status === "completed"
                ? "success"
                : execution.status === "failed"
                  ? "danger"
                  : "warning"
            }
          >
            {execution.status}
          </Chip>
        </Box>
        <Typography level="body-sm" color="neutral">
          Created {new Date(execution.createdAt).toLocaleString()}
          {execution.completedAt &&
            ` — completed ${new Date(execution.completedAt).toLocaleString()}`}
        </Typography>
      </Box>

      {/* Execution summary */}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <Box>
            <Typography level="body-xs" color="neutral">
              Symbols
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              {execution.symbols?.map((s) => (
                <Chip key={s} size="sm" variant="soft" color="neutral">
                  {s}
                </Chip>
              ))}
            </Box>
          </Box>
          <Box>
            <Typography level="body-xs" color="neutral">
              Strategies
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              {execution.strategies?.map((s) => (
                <Chip key={s} size="sm" variant="outlined" color="neutral">
                  {s}
                </Chip>
              ))}
            </Box>
          </Box>
          <Box>
            <Typography level="body-xs" color="neutral">
              Results
            </Typography>
            <Typography level="body-sm" sx={{ mt: 0.5 }}>
              {execution.summary?.totalResults ?? results.length} total
              {execution.summary?.failed > 0 &&
                `, ${execution.summary.failed} failed`}
            </Typography>
          </Box>
          <Box>
            <Typography level="body-xs" color="neutral">
              Total Signals
            </Typography>
            <Typography level="body-sm" sx={{ mt: 0.5 }}>
              {execution.summary?.totalSignals ?? 0}
            </Typography>
          </Box>
        </Box>
      </Card>

      {/* Results table with multi-select */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography level="title-md">
            Results ({results.length})
          </Typography>
          {checkedIds.size > 0 && (
            <Chip size="sm" variant="soft" color="primary">
              {checkedIds.size} selected
            </Chip>
          )}
          <Typography level="body-xs" color="neutral">
            Select results to overlay their signals on the chart below.
          </Typography>
        </Box>

        {results.length === 0 ? (
          <Typography level="body-sm" color="neutral">
            No results for this execution.
          </Typography>
        ) : (
          <Sheet
            variant="outlined"
            sx={{ borderRadius: "sm", overflow: "auto", maxHeight: 400 }}
          >
            <Table
              size="sm"
              stickyHeader
              sx={{ "& thead th": { bgcolor: "background.surface" } }}
            >
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <Checkbox
                      size="sm"
                      checked={
                        results.length > 0 &&
                        checkedIds.size === results.length
                      }
                      indeterminate={
                        checkedIds.size > 0 &&
                        checkedIds.size < results.length
                      }
                      onChange={toggleAllChecked}
                    />
                  </th>
                  <th>Symbol</th>
                  <th>Strategy</th>
                  <th>Timeframe</th>
                  <th>Signals</th>
                  <th>Avg Strength</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => toggleChecked(r._id)}
                    style={{
                      cursor: "pointer",
                      background: checkedIds.has(r._id)
                        ? "rgba(25, 118, 210, 0.12)"
                        : undefined,
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        size="sm"
                        checked={checkedIds.has(r._id)}
                        onChange={() => toggleChecked(r._id)}
                      />
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {r.symbol}
                      </Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft" color="neutral">
                        {r.strategy}
                      </Chip>
                    </td>
                    <td>{r.timeframe}</td>
                    <td>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          alignItems: "center",
                        }}
                      >
                        <Typography level="body-sm">
                          {r.summary?.totalSignals ?? 0}
                        </Typography>
                        {(r.summary?.buySignals > 0 ||
                          r.summary?.sellSignals > 0) && (
                          <Typography level="body-xs" color="neutral">
                            ({r.summary.buySignals}B / {r.summary.sellSignals}S)
                          </Typography>
                        )}
                      </Box>
                    </td>
                    <td>
                      {r.summary?.avgStrength != null ? (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <LinearProgress
                            determinate
                            value={r.summary.avgStrength}
                            size="sm"
                            sx={{ flexGrow: 1, maxWidth: 80 }}
                            color={
                              r.summary.avgStrength >= 70
                                ? "success"
                                : r.summary.avgStrength >= 40
                                  ? "warning"
                                  : "danger"
                            }
                          />
                          <Typography level="body-xs">
                            {r.summary.avgStrength}
                          </Typography>
                        </Box>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={
                          r.status === "completed"
                            ? "success"
                            : r.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Sheet>
        )}
      </Box>

      {/* Chart */}
      {checkedIds.size > 0 && (
        <Card variant="outlined" sx={{ p: 2 }}>
          {/* Toolbar */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
              mb: 2,
            }}
          >
            <Box>
              <Typography level="title-md">
                {chartSymbol ?? "—"} ({chartTimeframe ?? "—"})
              </Typography>
              <Typography level="body-xs" color="neutral">
                {mergedSignals.length} signal
                {mergedSignals.length !== 1 ? "s" : ""} from{" "}
                {chartStrategyNames.length} strateg
                {chartStrategyNames.length !== 1 ? "ies" : "y"}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {availableChartSymbols.length > 1 && (
                <Select
                  size="sm"
                  value={chartSymbol}
                  onChange={(_, v) => setChartSymbol(v)}
                  sx={{ minWidth: 110 }}
                >
                  {availableChartSymbols.map((s) => (
                    <Option key={s} value={s}>
                      {s}
                    </Option>
                  ))}
                </Select>
              )}
              {availableTimeframes.length > 1 && (
                <Select
                  size="sm"
                  value={chartTimeframe}
                  onChange={(_, v) => setChartTimeframe(v)}
                  sx={{ minWidth: 90 }}
                >
                  {availableTimeframes.map((tf) => (
                    <Option key={tf} value={tf}>
                      {tf}
                    </Option>
                  ))}
                </Select>
              )}
            </Box>
          </Box>

          {/* Strategy colour legend */}
          {chartStrategyNames.length > 1 && (
            <Box
              sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}
            >
              {chartStrategyNames.map((name) => (
                <Chip
                  key={name}
                  size="sm"
                  variant="soft"
                  sx={{ "--Chip-decoratorChildHeight": "10px", gap: 0.5 }}
                  startDecorator={
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: strategyColor(name, chartStrategyNames),
                      }}
                    />
                  }
                >
                  {name}
                </Chip>
              ))}
            </Box>
          )}

          {/* Chart area */}
          {priceLoading || fetchingResults ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress size="sm" />
            </Box>
          ) : !hasChart ? (
            <Typography level="body-sm" color="neutral" sx={{ p: 4 }}>
              Select results that share the same symbol and timeframe to view
              the chart.
            </Typography>
          ) : candles.length === 0 ? (
            <Typography level="body-sm" color="neutral" sx={{ p: 4 }}>
              No price data available for {chartSymbol}/{chartTimeframe}.
            </Typography>
          ) : (
            <CandlestickChart
              candles={candles}
              signals={mergedSignals.map((sig) => ({
                ...sig,
                _color:
                  chartStrategyNames.length > 1
                    ? strategyColor(sig.strategy, chartStrategyNames)
                    : undefined,
                _label:
                  chartStrategyNames.length > 1
                    ? `${sig.strategy} ${sig.type.toUpperCase()} ${sig.strength ?? ""}`
                    : undefined,
              }))}
              height={500}
            />
          )}

          {/* Signal history table */}
          {mergedSignals.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography level="body-xs" sx={{ mb: 1, fontWeight: 600 }}>
                Signal History
              </Typography>
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "sm",
                  overflow: "auto",
                  maxHeight: 300,
                }}
              >
                <Table
                  size="sm"
                  sx={{
                    "& thead th": { bgcolor: "background.surface" },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Strategy</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Strength</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mergedSignals]
                      .sort(
                        (a, b) =>
                          new Date(b.timestamp) - new Date(a.timestamp)
                      )
                      .map((sig, i) => (
                        <tr key={i}>
                          <td>
                            <Typography level="body-xs">
                              {new Date(sig.timestamp).toLocaleString()}
                            </Typography>
                          </td>
                          <td>
                            <Chip
                              size="sm"
                              variant="soft"
                              sx={{ gap: 0.5 }}
                              startDecorator={
                                chartStrategyNames.length > 1 ? (
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      bgcolor: strategyColor(
                                        sig.strategy,
                                        chartStrategyNames
                                      ),
                                    }}
                                  />
                                ) : undefined
                              }
                            >
                              {sig.strategy}
                            </Chip>
                          </td>
                          <td>
                            <Chip
                              size="sm"
                              variant="soft"
                              color={
                                sig.type === "buy" ? "success" : "danger"
                              }
                            >
                              {sig.type}
                            </Chip>
                          </td>
                          <td>
                            <Typography level="body-sm">
                              {sig.price?.toFixed(2)}
                            </Typography>
                          </td>
                          <td>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <LinearProgress
                                determinate
                                value={sig.strength}
                                size="sm"
                                sx={{ flexGrow: 1, maxWidth: 60 }}
                                color={
                                  sig.strength >= 70
                                    ? "success"
                                    : sig.strength >= 40
                                      ? "warning"
                                      : "danger"
                                }
                              />
                              <Typography level="body-xs">
                                {sig.strength}
                              </Typography>
                            </Box>
                          </td>
                          <td>
                            <Typography
                              level="body-xs"
                              sx={{
                                maxWidth: 400,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={sig.reason}
                            >
                              {sig.reason}
                            </Typography>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </Sheet>
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}

import { useState, useCallback } from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import Switch from "@mui/joy/Switch";
import Chip from "@mui/joy/Chip";
import Slider from "@mui/joy/Slider";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import { useApi } from "../hooks/useApi";

const TIMEFRAME_OPTIONS = ["1m", "5m", "15m", "30m", "1h", "1d"];
const STRATEGY_OPTIONS = ["ma_crossover", "rsi_reversal", "macd_crossover", "bollinger_reversal"];

function ChipSelect({ options, selected, onChange }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <Chip
            key={opt}
            size="sm"
            variant={isSelected ? "solid" : "outlined"}
            color={isSelected ? "primary" : "neutral"}
            onClick={() => {
              if (isSelected) {
                onChange(selected.filter((s) => s !== opt));
              } else {
                onChange([...selected, opt]);
              }
            }}
            sx={{ cursor: "pointer" }}
          >
            {opt}
          </Chip>
        );
      })}
    </Box>
  );
}

function WatchlistItem({ item, onSave, onRemove }) {
  const [active, setActive] = useState(item.active !== false);
  const [timeframes, setTimeframes] = useState(item.timeframes || []);
  const [strategies, setStrategies] = useState(item.strategies || []);
  const [threshold, setThreshold] = useState(item.alertThreshold ?? 50);
  const [cooldown, setCooldown] = useState(item.signalCooldown ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasChanges =
    active !== (item.active !== false) ||
    JSON.stringify(timeframes) !== JSON.stringify(item.timeframes || []) ||
    JSON.stringify(strategies) !== JSON.stringify(item.strategies || []) ||
    threshold !== (item.alertThreshold ?? 50) ||
    cooldown !== (item.signalCooldown ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = { active, timeframes, strategies, alertThreshold: threshold };
      if (cooldown !== "") updates.signalCooldown = Number(cooldown);
      await onSave(item.symbol, updates);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove(item.symbol);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography level="title-md" sx={{ fontWeight: 700 }}>
          {item.symbol}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography level="body-sm">Active</Typography>
          <Switch
            size="sm"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography level="body-xs" sx={{ mb: 0.5 }}>
          Timeframes
        </Typography>
        <ChipSelect
          options={TIMEFRAME_OPTIONS}
          selected={timeframes}
          onChange={setTimeframes}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography level="body-xs" sx={{ mb: 0.5 }}>
          Strategies
        </Typography>
        <ChipSelect
          options={STRATEGY_OPTIONS}
          selected={strategies}
          onChange={setStrategies}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography level="body-xs" sx={{ mb: 0.5 }}>
          Alert Threshold: {threshold}
        </Typography>
        <Slider
          size="sm"
          value={threshold}
          onChange={(_, v) => setThreshold(v)}
          min={0}
          max={100}
          valueLabelDisplay="auto"
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography level="body-xs" sx={{ mb: 0.5 }}>
          Signal Cooldown (minutes)
        </Typography>
        <Input
          size="sm"
          type="number"
          placeholder="Default (env: 30)"
          value={cooldown}
          onChange={(e) => setCooldown(e.target.value === "" ? "" : Number(e.target.value))}
          slotProps={{ input: { min: 1, max: 1440 } }}
          sx={{ maxWidth: 200 }}
        />
        <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
          Min time between same-type signals. Leave empty to use the server default.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          size="sm"
          color="danger"
          variant="soft"
          loading={removing}
          onClick={handleRemove}
        >
          Remove
        </Button>
        <Button
          size="sm"
          variant="solid"
          loading={saving}
          disabled={!hasChanges}
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>
    </Card>
  );
}

export default function Settings() {
  const { data: watchlist, loading, error, refetch } = useApi("/api/watchlist");
  const [newSymbol, setNewSymbol] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  const items = Array.isArray(watchlist)
    ? watchlist
    : watchlist?.data ?? [];

  const handleAdd = useCallback(async () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      setNewSymbol("");
      refetch();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }, [newSymbol, refetch]);

  const handleSave = useCallback(
    async (symbol, updates) => {
      const res = await fetch(`/api/watchlist/${symbol}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save");
      refetch();
    },
    [refetch]
  );

  const handleRemove = useCallback(
    async (symbol) => {
      const res = await fetch(`/api/watchlist/${symbol}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");
      refetch();
    },
    [refetch]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography level="h3">Settings</Typography>

      {/* Add symbol */}
      <Sheet variant="outlined" sx={{ borderRadius: "sm", p: 2 }}>
        <Typography level="title-md" sx={{ mb: 2 }}>
          Add Symbol to Watchlist
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Input
            size="sm"
            placeholder="e.g. BTCUSDT"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            sx={{ flexGrow: 1, maxWidth: 300 }}
          />
          <Button
            size="sm"
            variant="solid"
            loading={adding}
            onClick={handleAdd}
            disabled={!newSymbol.trim()}
          >
            Add
          </Button>
        </Box>
        {addError && (
          <Typography level="body-sm" color="danger" sx={{ mt: 1 }}>
            {addError}
          </Typography>
        )}
      </Sheet>

      {/* Watchlist items */}
      <Typography level="title-md">
        Watchlist ({items.length})
      </Typography>

      {error && (
        <Typography level="body-sm" color="danger">
          Error loading watchlist: {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Typography level="body-sm" color="neutral">
          No symbols in watchlist. Add one above.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((item) => (
            <WatchlistItem
              key={item.symbol}
              item={item}
              onSave={handleSave}
              onRemove={handleRemove}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

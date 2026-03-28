import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import Slider from "@mui/joy/Slider";
import Input from "@mui/joy/Input";
import Switch from "@mui/joy/Switch";
import Divider from "@mui/joy/Divider";
import AccordionGroup from "@mui/joy/AccordionGroup";
import Accordion from "@mui/joy/Accordion";
import AccordionSummary from "@mui/joy/AccordionSummary";
import AccordionDetails from "@mui/joy/AccordionDetails";
import { useApi } from "../hooks/useApi";

// ---------------------------------------------------------------------------
// Reusable checkbox grid
// ---------------------------------------------------------------------------

function CheckboxGroup({ label, options, selected, onChange }) {
  const toggleItem = (item) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography level="body-xs" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Chip
          size="sm"
          variant="soft"
          color="neutral"
          onClick={toggleAll}
          sx={{ cursor: "pointer", fontSize: "0.7rem" }}
        >
          {selected.length === options.length ? "Deselect All" : "Select All"}
        </Chip>
        <Typography level="body-xs" color="neutral">
          {selected.length}/{options.length}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        {options.map((opt) => (
          <Checkbox
            key={opt}
            size="sm"
            label={opt}
            checked={selected.includes(opt)}
            onChange={() => toggleItem(opt)}
          />
        ))}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Parameter editor for a single strategy
// ---------------------------------------------------------------------------

function StrategyParamEditor({ parameters, values, onChange }) {
  if (!parameters || parameters.length === 0) return null;

  const handleChange = (paramName, value) => {
    onChange({ ...values, [paramName]: value });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {parameters.map((param) => {
        const currentValue =
          values[param.name] !== undefined ? values[param.name] : param.default;

        if (param.type === "boolean") {
          return (
            <Box
              key={param.name}
              sx={{ display: "flex", alignItems: "center", gap: 2 }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {param.name.replace(/_/g, " ")}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  {param.description}
                </Typography>
              </Box>
              <Switch
                size="sm"
                checked={!!currentValue}
                onChange={(e) => handleChange(param.name, e.target.checked)}
                color={currentValue ? "success" : "neutral"}
              />
            </Box>
          );
        }

        // Default: number type with slider + input
        return (
          <Box key={param.name}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.5,
              }}
            >
              <Box>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {param.name.replace(/_/g, " ")}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  {param.description}
                </Typography>
              </Box>
              <Input
                size="sm"
                type="number"
                value={currentValue}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) handleChange(param.name, v);
                }}
                slotProps={{
                  input: {
                    min: param.min,
                    max: param.max,
                    step: param.step || 1,
                  },
                }}
                sx={{ width: 80 }}
              />
            </Box>
            <Slider
              size="sm"
              value={currentValue}
              min={param.min}
              max={param.max}
              step={param.step || 1}
              onChange={(_, v) => handleChange(param.name, v)}
              valueLabelDisplay="auto"
              marks={[
                { value: param.min, label: String(param.min) },
                { value: param.default, label: `${param.default} (default)` },
                { value: param.max, label: String(param.max) },
              ]}
              sx={{ mx: 1 }}
            />
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Strategy parameters panel (right column)
// ---------------------------------------------------------------------------

function StrategyParamsPanel({
  selectedStrategies,
  strategiesData,
  strategyParams,
  onParamsChange,
}) {
  const strategiesByName = useMemo(() => {
    const raw = Array.isArray(strategiesData)
      ? strategiesData
      : strategiesData?.data ?? [];
    const map = {};
    raw.forEach((s) => {
      map[s.name] = s;
    });
    return map;
  }, [strategiesData]);

  const configurableStrategies = selectedStrategies.filter((name) => {
    const s = strategiesByName[name];
    return s && s.parameters && s.parameters.length > 0;
  });

  if (selectedStrategies.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: 200,
        }}
      >
        <Typography level="body-sm" color="neutral" sx={{ textAlign: "center" }}>
          Select strategies on the left to configure their parameters.
        </Typography>
      </Box>
    );
  }

  if (configurableStrategies.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: 200,
        }}
      >
        <Typography level="body-sm" color="neutral" sx={{ textAlign: "center" }}>
          The selected strategies have no configurable parameters.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {configurableStrategies.map((name) => {
        const strategy = strategiesByName[name];
        const params = strategyParams[name] || {};
        const isCustomized = Object.keys(params).length > 0;

        return (
          <Card
            key={name}
            variant="soft"
            sx={{
              p: 0,
              overflow: "hidden",
              borderLeft: "3px solid",
              borderColor: isCustomized ? "warning.400" : "primary.400",
            }}
          >
            <AccordionGroup size="sm" variant="plain">
              <Accordion defaultExpanded>
                <AccordionSummary sx={{ px: 2, py: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {name}
                    </Typography>
                    <Chip size="sm" variant="soft" color="primary">
                      {strategy.parameters.length} param
                      {strategy.parameters.length > 1 ? "s" : ""}
                    </Chip>
                    {isCustomized && (
                      <Chip size="sm" variant="soft" color="warning">
                        customized
                      </Chip>
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pb: 2 }}>
                  {strategy.description && (
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ mb: 1.5 }}
                    >
                      {strategy.description}
                    </Typography>
                  )}

                  <StrategyParamEditor
                    parameters={strategy.parameters}
                    values={params}
                    onChange={(newValues) => onParamsChange(name, newValues)}
                  />
                </AccordionDetails>
              </Accordion>
            </AccordionGroup>
          </Card>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// New Test Execution page — two-column layout
// ---------------------------------------------------------------------------

export default function TesterNew() {
  const navigate = useNavigate();

  const { data: symbolsData, loading: symbolsLoading } = useApi(
    "/api/backtest/symbols"
  );
  const { data: strategiesData, loading: strategiesLoading } =
    useApi("/api/strategies");

  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [strategyParams, setStrategyParams] = useState({});
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  const symbols = useMemo(
    () => (Array.isArray(symbolsData) ? symbolsData : symbolsData?.data ?? []),
    [symbolsData]
  );
  const strategies = useMemo(() => {
    const raw = Array.isArray(strategiesData)
      ? strategiesData
      : strategiesData?.data ?? [];
    return raw.map((s) => s.name);
  }, [strategiesData]);

  const handleParamsChange = useCallback((strategyName, newValues) => {
    setStrategyParams((prev) => ({
      ...prev,
      [strategyName]: newValues,
    }));
  }, []);

  const buildStrategyParamsPayload = useCallback(() => {
    const payload = {};
    for (const [name, params] of Object.entries(strategyParams)) {
      if (
        selectedStrategies.includes(name) &&
        Object.keys(params).length > 0
      ) {
        payload[name] = params;
      }
    }
    return Object.keys(payload).length > 0 ? payload : undefined;
  }, [strategyParams, selectedStrategies]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const body = {
        symbols: selectedSymbols,
        strategies: selectedStrategies,
      };

      const paramsPayload = buildStrategyParamsPayload();
      if (paramsPayload) {
        body.strategyParams = paramsPayload;
      }

      const res = await fetch("/api/backtest/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const execution = await res.json();
      navigate(`/tester/${execution._id}`);
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  }, [
    selectedSymbols,
    selectedStrategies,
    buildStrategyParamsPayload,
    navigate,
  ]);

  const isLoading = symbolsLoading || strategiesLoading;

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
          <Typography level="h3">Backtest Configuration</Typography>
        </Box>
        <Typography level="body-sm" color="neutral">
          Choose the assets and strategies to backtest, then fine-tune strategy
          parameters to optimise results.
        </Typography>
      </Box>

      {/* Two-column body */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
          <CircularProgress size="sm" />
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          {/* ---- LEFT COLUMN: Selection ---- */}
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography level="title-md" sx={{ mb: 2 }}>
              Selection
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <CheckboxGroup
                label="Tickers"
                options={symbols}
                selected={selectedSymbols}
                onChange={setSelectedSymbols}
              />

              <Divider />

              <CheckboxGroup
                label="Strategies"
                options={strategies}
                selected={selectedStrategies}
                onChange={setSelectedStrategies}
              />

              <Divider />

              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5 }}
              >
                <Button
                  variant="solid"
                  color="primary"
                  loading={running}
                  disabled={
                    !selectedSymbols.length || !selectedStrategies.length
                  }
                  onClick={handleRun}
                >
                  Execute Test
                </Button>
                {running && (
                  <Typography level="body-sm" color="neutral">
                    Running tests...
                  </Typography>
                )}
              </Box>

              {runError && (
                <Typography level="body-sm" color="danger">
                  {runError}
                </Typography>
              )}
            </Box>
          </Card>

          {/* ---- RIGHT COLUMN: Parameter fine-tuning ---- */}
          <Card variant="outlined" sx={{ p: 2 }}>
            <Typography level="title-md" sx={{ mb: 2 }}>
              Fine-tuning
            </Typography>

            <StrategyParamsPanel
              selectedStrategies={selectedStrategies}
              strategiesData={strategiesData}
              strategyParams={strategyParams}
              onParamsChange={handleParamsChange}
            />
          </Card>
        </Box>
      )}
    </Box>
  );
}

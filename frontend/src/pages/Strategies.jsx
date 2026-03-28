import { useState } from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Chip from "@mui/joy/Chip";
import Switch from "@mui/joy/Switch";
import CircularProgress from "@mui/joy/CircularProgress";
import AccordionGroup from "@mui/joy/AccordionGroup";
import Accordion from "@mui/joy/Accordion";
import AccordionSummary from "@mui/joy/AccordionSummary";
import AccordionDetails from "@mui/joy/AccordionDetails";
import { useApi } from "../hooks/useApi";

// ---------------------------------------------------------------------------
// Parameter display for a single strategy
// ---------------------------------------------------------------------------

function ParametersList({ parameters }) {
  if (!parameters || parameters.length === 0) {
    return (
      <Typography level="body-xs" color="neutral" sx={{ fontStyle: "italic" }}>
        No configurable parameters
      </Typography>
    );
  }

  return (
    <Table size="sm" sx={{ "--TableCell-headBackground": "transparent" }}>
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Type</th>
          <th>Default</th>
          <th>Range</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {parameters.map((p) => (
          <tr key={p.name}>
            <td>
              <Typography
                level="body-xs"
                sx={{ fontFamily: "monospace", fontWeight: 600 }}
              >
                {p.name}
              </Typography>
            </td>
            <td>
              <Chip size="sm" variant="soft" color="neutral">
                {p.type}
              </Chip>
            </td>
            <td>
              <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                {String(p.default)}
              </Typography>
            </td>
            <td>
              <Typography level="body-xs">
                {p.type === "number" && p.min !== undefined && p.max !== undefined
                  ? `${p.min} - ${p.max}${p.step ? ` (step ${p.step})` : ""}`
                  : p.type === "boolean"
                  ? "true / false"
                  : "\u2014"}
              </Typography>
            </td>
            <td>
              <Typography level="body-xs" color="neutral">
                {p.description || "\u2014"}
              </Typography>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Main Strategies page
// ---------------------------------------------------------------------------

export default function Strategies() {
  const { data, loading, error, refetch } = useApi("/api/strategies");
  const [toggling, setToggling] = useState(null);

  const strategies = Array.isArray(data) ? data : data?.data ?? [];

  async function handleToggle(name, currentActive) {
    setToggling(name);
    try {
      await fetch(`/api/strategies/${name}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      refetch();
    } catch (err) {
      console.error("Failed to toggle strategy:", err);
    } finally {
      setToggling(null);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography level="h3">Strategies</Typography>
        <Typography level="body-sm" color="neutral">
          Analysis strategies are auto-discovered from Python files. Toggle them
          on or off to control which strategies generate signals. Expand each
          strategy to see its configurable parameters.
        </Typography>
      </Box>

      {error && (
        <Typography level="body-sm" color="danger">
          Error: {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : strategies.length === 0 ? (
        <Sheet variant="outlined" sx={{ borderRadius: "sm", p: 3 }}>
          <Typography level="body-sm" color="neutral">
            No strategies registered yet. Add a .py file to the strategies
            directory and restart the analysis service.
          </Typography>
        </Sheet>
      ) : (
        <AccordionGroup
          size="sm"
          variant="outlined"
          sx={{ borderRadius: "sm" }}
        >
          {strategies.map((s) => {
            const paramCount = s.parameters?.length || 0;

            return (
              <Accordion key={s.name}>
                <AccordionSummary>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      width: "100%",
                      pr: 1,
                    }}
                  >
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      {s.name}
                    </Typography>

                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ flex: 1 }}
                    >
                      {s.description || "\u2014"}
                    </Typography>

                    {paramCount > 0 && (
                      <Chip size="sm" variant="soft" color="primary">
                        {paramCount} param{paramCount > 1 ? "s" : ""}
                      </Chip>
                    )}

                    <Chip size="sm" variant="outlined">
                      {s.type || "local"}
                    </Chip>

                    <Switch
                      size="sm"
                      checked={s.active}
                      disabled={toggling === s.name}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggle(s.name, s.active);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      color={s.active ? "success" : "neutral"}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      py: 1,
                    }}
                  >
                    {s.path && (
                      <Typography
                        level="body-xs"
                        sx={{
                          fontFamily: "monospace",
                          color: "neutral.500",
                        }}
                      >
                        {s.path}
                      </Typography>
                    )}

                    <Box>
                      <Typography
                        level="body-xs"
                        sx={{ fontWeight: 600, mb: 1 }}
                      >
                        Configurable Parameters
                      </Typography>
                      <ParametersList parameters={s.parameters} />
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </AccordionGroup>
      )}
    </Box>
  );
}

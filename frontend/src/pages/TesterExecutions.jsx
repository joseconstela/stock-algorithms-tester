import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import CircularProgress from "@mui/joy/CircularProgress";
import { useApi } from "../hooks/useApi";

export default function TesterExecutions() {
  const navigate = useNavigate();
  const {
    data: execData,
    loading,
    error,
    refetch,
  } = useApi("/api/backtest/executions?limit=100");

  const executions = useMemo(
    () => (Array.isArray(execData) ? execData : execData?.data ?? []),
    [execData]
  );

  const handleDelete = useCallback(
    async (id, e) => {
      e.stopPropagation();
      try {
        await fetch(`/api/backtest/executions/${id}`, { method: "DELETE" });
        refetch();
      } catch {
        // silent
      }
    },
    [refetch]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography level="h3">Strategy Tester</Typography>
          <Typography level="body-sm" color="neutral">
            Test executions. Each execution runs selected strategies against
            selected tickers across all available timeframes.
          </Typography>
        </Box>
        <Button
          variant="solid"
          color="primary"
          onClick={() => navigate("/tester/new")}
        >
          New Test
        </Button>
      </Box>

      {error && (
        <Typography level="body-sm" color="danger">
          Error loading executions: {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : executions.length === 0 ? (
        <Typography level="body-sm" color="neutral">
          No test executions yet. Click "New Test" to create one.
        </Typography>
      ) : (
        <Sheet
          variant="outlined"
          sx={{ borderRadius: "sm", overflow: "auto" }}
        >
          <Table
            size="sm"
            stickyHeader
            sx={{ "& thead th": { bgcolor: "background.surface" } }}
          >
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbols</th>
                <th>Strategies</th>
                <th>Results</th>
                <th>Signals</th>
                <th>Status</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {executions.map((ex) => (
                <tr
                  key={ex._id}
                  onClick={() => navigate(`/tester/${ex._id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <Typography level="body-xs">
                      {new Date(ex.createdAt).toLocaleString()}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {ex.symbols?.map((s) => (
                        <Chip key={s} size="sm" variant="soft" color="neutral">
                          {s}
                        </Chip>
                      ))}
                    </Box>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {ex.strategies?.map((s) => (
                        <Chip key={s} size="sm" variant="outlined" color="neutral">
                          {s}
                        </Chip>
                      ))}
                    </Box>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {ex.summary?.totalResults ?? 0}
                      {ex.summary?.failed > 0 && (
                        <Typography
                          component="span"
                          level="body-xs"
                          color="danger"
                        >
                          {" "}
                          ({ex.summary.failed} failed)
                        </Typography>
                      )}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {ex.summary?.totalSignals ?? 0}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        ex.status === "completed"
                          ? "success"
                          : ex.status === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {ex.status}
                    </Chip>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="plain"
                      color="danger"
                      onClick={(e) => handleDelete(ex._id, e)}
                      sx={{ minWidth: 0, px: 1 }}
                    >
                      x
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}
    </Box>
  );
}

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
} from "lightweight-charts";

/**
 * Candlestick chart using TradingView's lightweight-charts v5.
 *
 * Props:
 *   candles  - Array of { timestamp, open, high, low, close, volume }
 *   signals  - Array of { timestamp, type: 'buy'|'sell', strength }  (optional)
 *   height   - Chart height in px (default 400)
 */
export default function CandlestickChart({ candles = [], signals = [], height = 400 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const markersRef = useRef(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // v5 API: chart.addSeries(SeriesType, options)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
    };
  }, [height]);

  // Update data when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles.length) return;

    const sorted = [...candles].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const candleData = sorted.map((c) => ({
      time: Math.floor(new Date(c.timestamp).getTime() / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }));

    const volumeData = sorted.map((c) => ({
      time: Math.floor(new Date(c.timestamp).getTime() / 1000),
      value: Number(c.volume || 0),
      color:
        Number(c.close) >= Number(c.open)
          ? "rgba(34,197,94,0.3)"
          : "rgba(239,68,68,0.3)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // v5 API: markers via createSeriesMarkers(series, markers)
    // Detach previous markers if any
    if (markersRef.current) {
      markersRef.current.detach();
      markersRef.current = null;
    }

    if (signals.length > 0) {
      const markerData = signals
        .filter((s) => s.type === "buy" || s.type === "sell")
        .map((s) => ({
          time: Math.floor(new Date(s.timestamp || s.createdAt).getTime() / 1000),
          position: s.type === "buy" ? "belowBar" : "aboveBar",
          color: s._color || (s.type === "buy" ? "#22c55e" : "#ef4444"),
          shape: s.type === "buy" ? "arrowUp" : "arrowDown",
          text: s._label || `${s.type.toUpperCase()} ${s.strength ?? ""}`,
        }))
        .sort((a, b) => a.time - b.time);

      markersRef.current = createSeriesMarkers(candleSeriesRef.current, markerData);
    }

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [candles, signals]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", minHeight: height, borderRadius: 8, overflow: "hidden" }}
    />
  );
}

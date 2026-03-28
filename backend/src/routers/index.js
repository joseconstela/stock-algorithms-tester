const express = require("express");
const router = express.Router();

const helloRouter = require("./hello.router");
const tickerRouter = require("./ticker.router");
const newsRouter = require("./news.router");
const priceRouter = require("./price.router");
const signalRouter = require("./signal.router");
const alertRouter = require("./alert.router");
const watchlistRouter = require("./watchlist.router");
const tradeRouter = require("./trade.router");
const strategyRouter = require("./strategy.router");
const backtestRouter = require("./backtest.router");

router.use("/hello", helloRouter);
router.use("/ticker", tickerRouter);
router.use("/news", newsRouter);
router.use("/prices", priceRouter);
router.use("/signals", signalRouter);
router.use("/alerts", alertRouter);
router.use("/watchlist", watchlistRouter);
router.use("/trades", tradeRouter);
router.use("/strategies", strategyRouter);
router.use("/backtest", backtestRouter);

module.exports = router;

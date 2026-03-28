import { CssVarsProvider } from "@mui/joy/styles";
import CssBaseline from "@mui/joy/CssBaseline";
import { Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TickerDetail from "./pages/TickerDetail";
import Signals from "./pages/Signals";
import Alerts from "./pages/Alerts";
import Trades from "./pages/Trades";
import Settings from "./pages/Settings";
import Strategies from "./pages/Strategies";
import TesterExecutions from "./pages/TesterExecutions";
import TesterNew from "./pages/TesterNew";
import TesterDetail from "./pages/TesterDetail";

function App() {
  return (
    <CssVarsProvider defaultMode="dark">
      <CssBaseline />
      <SocketProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ticker/:symbol" element={<TickerDetail />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/tester" element={<TesterExecutions />} />
            <Route path="/tester/new" element={<TesterNew />} />
            <Route path="/tester/:executionId" element={<TesterDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </SocketProvider>
    </CssVarsProvider>
  );
}

export default App;

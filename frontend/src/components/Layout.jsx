import { useState } from "react";
import { Outlet, NavLink as RouterNavLink } from "react-router-dom";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Badge from "@mui/joy/Badge";
import IconButton from "@mui/joy/IconButton";
import { useSocket } from "../useSocket";
import TradeApproval from "./TradeApproval";

// Simple SVG icon components
const DashboardIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);
const SignalIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const AlertIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const TradeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const SettingsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const MenuIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const TesterIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const SIDEBAR_WIDTH = 240;

const StrategyIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const navItems = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/signals", label: "Signals", icon: SignalIcon, badgeKey: "signals" },
  { to: "/strategies", label: "Strategies", icon: StrategyIcon },
  { to: "/tester", label: "Tester", icon: TesterIcon },
  { to: "/alerts", label: "Alerts", icon: AlertIcon, badgeKey: "alerts" },
  { to: "/trades", label: "Trades", icon: TradeIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavItem({ to, label, icon, badge }) {
  const IconComponent = icon;
  return (
    <ListItem>
      <ListItemButton
        component={RouterNavLink}
        to={to}
        end={to === "/"}
        sx={{
          borderRadius: "sm",
          "&.active": {
            bgcolor: "background.level2",
            fontWeight: "lg",
          },
        }}
      >
        <ListItemDecorator>
          <IconComponent />
        </ListItemDecorator>
        <ListItemContent>{label}</ListItemContent>
        {badge > 0 && (
          <Chip size="sm" variant="solid" color="danger">
            {badge}
          </Chip>
        )}
      </ListItemButton>
    </ListItem>
  );
}

export default function Layout() {
  const { isConnected, pendingAlertsCount } = useSocket();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <Sheet
      sx={{
        width: SIDEBAR_WIDTH,
        height: "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
        p: 2,
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography level="h4" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Investment algorithm tester
        </Typography>
        <Chip
          size="sm"
          variant="soft"
          color={isConnected ? "success" : "danger"}
        >
          {isConnected ? "Live" : "Offline"}
        </Chip>
      </Box>

      <List
        size="sm"
        sx={{
          "--ListItem-radius": "8px",
          "--List-gap": "4px",
          flexGrow: 1,
        }}
      >
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            badge={item.badgeKey === "alerts" ? pendingAlertsCount : undefined}
          />
        ))}
      </List>

      <Box sx={{ mt: "auto" }}>
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          https://github.com/joseconstela/stock-algorithms-tester
        </Typography>
      </Box>
    </Sheet>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      {/* Mobile menu button */}
      <IconButton
        variant="outlined"
        size="sm"
        onClick={() => setMobileOpen(!mobileOpen)}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 1100,
        }}
      >
        <MenuIcon />
      </IconButton>

      {/* Sidebar - always visible on desktop */}
      <Box
        sx={{
          display: { xs: mobileOpen ? "block" : "none", md: "block" },
          position: { xs: "fixed", md: "sticky" },
          top: 0,
          zIndex: { xs: 1050, md: 0 },
          height: "100vh",
        }}
      >
        {sidebar}
      </Box>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <Box
          onClick={() => setMobileOpen(false)}
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed",
            inset: 0,
            zIndex: 1040,
            bgcolor: "rgba(0,0,0,0.5)",
          }}
        />
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          pt: { xs: 6, md: 3 },
          overflow: "auto",
          minHeight: "100vh",
        }}
      >
        <Outlet />
      </Box>

      <TradeApproval />
    </Box>
  );
}

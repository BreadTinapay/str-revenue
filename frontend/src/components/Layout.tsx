import {
  BarChart3,
  Building2,
  History,
  KeyRound,
  LogOut,
  Mail,
  Menu,
  Moon,
  Search,
  Sun,
  Users as UsersIcon,
  UserCog,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const navItems = [
  { to: "/discover", label: "Discover", icon: Search },
  { to: "/leads", label: "Leads", icon: UsersIcon },
  { to: "/campaigns", label: "Campaigns", icon: Mail },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

const adminNavItems = [
  { to: "/users", label: "Users", icon: UserCog },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/settings", label: "Settings", icon: Building2 },
];

const LOGO_URL = "/logo.webp";

export default function Layout() {
  const { logout, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const items = role === "admin" ? [...navItems, ...adminNavItems] : navItems;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <img src={LOGO_URL} alt="STR Revenue" className="h-7 w-auto" />
                <span className="font-serif text-base tracking-wide text-foreground">STR Revenue</span>
              </div>
              <nav className="hidden gap-1 lg:flex">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild aria-label="Change password">
                    <NavLink to="/account/password">
                      <KeyRound className="h-4 w-4" />
                    </NavLink>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Account settings</TooltipContent>
              </Tooltip>
              <Avatar className="hidden h-8 w-8 sm:flex">
                <AvatarFallback>{role?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Log out</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="border-t border-border px-4 pb-3 pt-2 lg:hidden">
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}
        </header>
        <main className="container py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}

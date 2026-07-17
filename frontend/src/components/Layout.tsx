import { BarChart3, LogOut, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

const LOGO_URL = "/logo.webp";

export default function Layout() {
  const { logout, role } = useAuth();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <img src={LOGO_URL} alt="STR Revenue" className="h-7 w-auto" />
                <span className="font-serif text-base tracking-wide text-white">STR Revenue</span>
              </div>
              <nav className="flex gap-1">
                {navItems.map((item) => (
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
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
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
            </div>
          </div>
        </header>
        <main className="container py-8">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}

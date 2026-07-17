import { Lock, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../lib/auth";

const LOGO_URL = "/logo.webp";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/leads" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/leads");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-5">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(199_98%_47%/0.18),transparent_55%),radial-gradient(circle_at_80%_80%,hsl(199_98%_47%/0.10),transparent_50%)] lg:col-span-2 lg:flex lg:flex-col lg:justify-between lg:border-r lg:border-border lg:bg-card lg:p-12">
        <img src={LOGO_URL} alt="STR Revenue" className="h-100 w-auto" />

        <div>
          <h1 className="mb-4 font-serif text-4xl leading-tight text-white text-balance">
            Revenue management, done with precision.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Market intelligence and lead enrichment for short-term rental revenue teams — pricing signals,
            verified contacts, and clean provenance in one place.
          </p>
        </div>

        <div className="flex gap-10">
          <div>
            <p className="font-serif text-3xl text-primary">10–20%</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue growth</p>
          </div>
          <div>
            <p className="font-serif text-3xl text-primary">600+</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Properties managed</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="col-span-1 flex items-center justify-center bg-background px-6 py-12 lg:col-span-3">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <img src={LOGO_URL} alt="STR Revenue" className="mb-6 h-8 w-auto lg:hidden" />
          <h2 className="mb-1 font-serif text-2xl text-white">Welcome back</h2>
          <p className="mb-8 text-sm text-muted-foreground">Sign in to the lead dashboard</p>

          <div className="mb-4 space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="mb-6 space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

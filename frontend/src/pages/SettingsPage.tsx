import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { fetchSettings, updateSettings, type AppSettings } from "../lib/api";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateSettings(form);
      setForm(updated);
      queryClient.setQueryData(["settings"], updated);
      setSaved(true);
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Sender identity and CAN-SPAM compliance details used on every campaign email
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Sender &amp; compliance
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          {isLoading || !form ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>From name</Label>
                  <Input
                    value={form.email_from_name}
                    onChange={(e) => setForm({ ...form, email_from_name: e.target.value })}
                    required
                    placeholder="STR Revenue"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>From email</Label>
                  <Input
                    type="email"
                    value={form.email_from_address}
                    onChange={(e) => setForm({ ...form, email_from_address: e.target.value })}
                    required
                    placeholder="outreach@yourdomain.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Reply-to (optional)</Label>
                <Input
                  type="email"
                  value={form.email_reply_to ?? ""}
                  onChange={(e) => setForm({ ...form, email_reply_to: e.target.value || null })}
                  placeholder="hello@yourdomain.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label>CAN-SPAM physical mailing address</Label>
                <textarea
                  value={form.company_physical_address}
                  onChange={(e) => setForm({ ...form, company_physical_address: e.target.value })}
                  required
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Company Name, Street Address, City, State ZIP, Country"
                />
                <p className="text-xs text-muted-foreground">
                  Required by law on every marketing email. Campaign sends are blocked until this is set to a real
                  address.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="text-sm text-success">Settings saved.</p>}

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save settings"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

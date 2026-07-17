import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmailPreview } from "../components/EmailPreview";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { createCampaign, fetchCampaigns } from "../lib/api";

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted"> = {
  completed: "success",
  sending: "warning",
  failed: "warning",
  draft: "muted",
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Compose and send outreach to your deduplicated leads</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {showForm && (
        <NewCampaignForm
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
          }}
        />
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Target market</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && campaigns?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
                      <Mail className="h-5 w-5" />
                    </div>
                    <p>No campaigns yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {campaigns?.map((c) => (
              <TableRow key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.target_filter?.city ? `${c.target_filter.city}, ${c.target_filter.state ?? ""}` : "All markets"}
                  {c.target_filter?.confidence ? ` · ${c.target_filter.confidence} confidence` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "muted"} className="capitalize">
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function NewCampaignForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("<p>Hi {{name}},</p><p></p>");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [confidence, setConfidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCampaign({
        name,
        subject_template: subject,
        body_html_template: body,
        target_filter: {
          city: city || undefined,
          state: state || undefined,
          confidence: confidence || undefined,
        },
      });
      onCreated();
    } catch {
      setError("Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Fall outreach — Austin" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Target city (optional)</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
            </div>
            <div className="space-y-1.5">
              <Label>Target state (optional)</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" />
            </div>
            <div className="space-y-1.5">
              <Label>Min confidence (optional)</Label>
              <Input value={confidence} onChange={(e) => setConfidence(e.target.value)} placeholder="high" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="Hi {{name}}, quick question about your listing"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body template (HTML, use {"{{name}}"}, {"{{city}}"}, {"{{state}}"})</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={8} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create campaign"}
          </Button>
        </form>

        <div className="lg:border-l lg:border-border lg:pl-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
          <Separator className="mb-4 lg:hidden" />
          <EmailPreview subject={subject} bodyHtml={body} />
        </div>
      </CardContent>
    </Card>
  );
}

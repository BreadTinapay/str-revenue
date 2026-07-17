import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { EmailPreview } from "../components/EmailPreview";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  excludeCampaignLead,
  fetchCampaign,
  fetchCampaignSends,
  fetchCampaignTargets,
  getCampaignJob,
  includeCampaignLead,
  pollJob,
  sendCampaign,
} from "../lib/api";

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted"> = {
  sent: "success",
  completed: "success",
  sending: "warning",
  failed: "warning",
  suppressed: "muted",
  draft: "muted",
  pending: "muted",
};

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => fetchCampaign(campaignId!),
    enabled: Boolean(campaignId),
  });

  const { data: sends } = useQuery({
    queryKey: ["campaign-sends", campaignId],
    queryFn: () => fetchCampaignSends(campaignId!),
    enabled: Boolean(campaignId),
    refetchInterval: (query) => (query.state.data ? false : 3000),
  });

  const { data: targets } = useQuery({
    queryKey: ["campaign-targets", campaignId],
    queryFn: () => fetchCampaignTargets(campaignId!),
    enabled: Boolean(campaignId) && campaign?.status === "draft",
  });

  const [togglingLeadId, setTogglingLeadId] = useState<string | null>(null);

  async function toggleExclusion(leadId: string, currentlyExcluded: boolean) {
    if (!campaignId) return;
    setTogglingLeadId(leadId);
    try {
      if (currentlyExcluded) {
        await includeCampaignLead(campaignId, leadId);
      } else {
        await excludeCampaignLead(campaignId, leadId);
      }
      queryClient.invalidateQueries({ queryKey: ["campaign-targets", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    } finally {
      setTogglingLeadId(null);
    }
  }

  async function handleSend() {
    if (!campaignId) return;
    setSendError(null);
    setSending(true);
    try {
      const job = await sendCampaign(campaignId);
      const result = await pollJob(getCampaignJob, job.job_id);
      if (result.status === "failed") {
        setSendError(
          "Send failed — check that a physical mailing address is configured (required by CAN-SPAM before any send).",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-sends", campaignId] });
    } catch {
      setSendError("Failed to trigger send.");
    } finally {
      setSending(false);
    }
  }

  if (isLoading || !campaign) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link to="/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="font-serif text-2xl text-foreground">{campaign.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{campaign.subject_template}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[campaign.status] ?? "muted"} className="capitalize">
              {campaign.status}
            </Badge>
            {campaign.status === "draft" && (
              <Button
                onClick={handleSend}
                disabled={sending || campaign.matching_lead_count === 0}
                className="shadow-glow"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Send campaign"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {campaign.status === "draft" && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          {campaign.matching_lead_count === 0 ? (
            <span className="text-muted-foreground">
              No leads currently match this campaign's filter — nothing will be sent yet.
            </span>
          ) : (
            <span>
              <strong>{campaign.matching_lead_count}</strong> lead{campaign.matching_lead_count === 1 ? "" : "s"}{" "}
              currently match{campaign.matching_lead_count === 1 ? "es" : ""} this filter and will receive this
              email when sent.
            </span>
          )}
        </div>
      )}

      {sendError && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sendError}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Email preview</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          <EmailPreview subject={campaign.subject_template} bodyHtml={campaign.body_html_template} />
        </CardContent>
      </Card>

      {campaign.status === "draft" && targets && targets.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Target leads ({targets.length})</CardTitle>
          </CardHeader>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-foreground">{t.canonical_name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.best_email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.city}, {t.state}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {t.excluded && (
                        <Badge variant="muted" className="capitalize">
                          Excluded
                        </Badge>
                      )}
                      {t.is_suppressed && (
                        <Badge variant="warning" className="capitalize">
                          Opted out
                        </Badge>
                      )}
                      {!t.excluded && !t.is_suppressed && (
                        <Badge variant="success" className="capitalize">
                          Will send
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={togglingLeadId === t.id || t.is_suppressed}
                      onClick={() => toggleExclusion(t.id, t.excluded)}
                    >
                      {t.excluded ? "Include" : "Exclude"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients ({sends?.length ?? 0})</CardTitle>
        </CardHeader>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Sent at</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!sends || sends.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {campaign.status === "draft"
                    ? "Not sent yet — recipients appear here once you click \"Send campaign\"."
                    : "No recipients matched this campaign's filter."}
                </TableCell>
              </TableRow>
            )}
            {sends?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-foreground">{s.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status] ?? "muted"} className="capitalize">
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{s.provider ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.sent_at ? new Date(s.sent_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-destructive">{s.error_message ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

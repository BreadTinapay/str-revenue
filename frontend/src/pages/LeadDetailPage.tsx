import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Globe, Mail, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ConfidenceBadge from "../components/ConfidenceBadge";
import LeadAvatar from "../components/LeadAvatar";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { fetchLeadDetail, fetchLeadSendHistory } from "../lib/api";

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted"> = {
  sent: "success",
  failed: "warning",
  suppressed: "muted",
  pending: "muted",
};

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => fetchLeadDetail(leadId!),
    enabled: Boolean(leadId),
  });

  const { data: sendHistory } = useQuery({
    queryKey: ["lead-send-history", leadId],
    queryFn: () => fetchLeadSendHistory(leadId!),
    enabled: Boolean(leadId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !lead) return <p className="text-destructive">Failed to load lead.</p>;

  return (
    <div className="animate-fade-in">
      <Link
        to="/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <LeadAvatar name={lead.canonical_name} className="h-14 w-14 text-lg" />
            <div>
              <h1 className="font-serif text-2xl text-foreground">{lead.canonical_name}</h1>
              <p className="text-sm text-muted-foreground">
                {lead.city}, {lead.state} · {lead.listing_count} listing{lead.listing_count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lead.is_suppressed && (
              <Badge variant="warning" title={lead.suppression_reason ?? undefined}>
                Opted out{lead.suppression_reason ? ` · ${lead.suppression_reason.replace("_", " ")}` : ""}
              </Badge>
            )}
            <ConfidenceBadge confidence={lead.best_confidence_score} />
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoTile icon={Mail} label="Email" value={lead.best_email} />
        <InfoTile icon={Phone} label="Phone" value={lead.best_phone} />
        <InfoTile icon={Globe} label="Website" value={lead.best_website} href={lead.best_website ?? undefined} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Source listings ({lead.source_listings.length})</CardTitle>
        </CardHeader>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing ID</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead>Property type</TableHead>
              <TableHead>Price/night</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Scraped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lead.source_listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell className="text-muted-foreground">{listing.listing_id}</TableCell>
                <TableCell className="font-medium text-foreground">{listing.host_display_name}</TableCell>
                <TableCell className="text-muted-foreground">{listing.property_type ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {listing.nightly_price ? `$${listing.nightly_price} ${listing.currency}` : "—"}
                </TableCell>
                <TableCell>
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(listing.scraped_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Merge history ({lead.merge_history.length})</CardTitle>
        </CardHeader>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Match type</TableHead>
              <TableHead>Similarity</TableHead>
              <TableHead>Merged at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lead.merge_history.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-foreground">{entry.match_type}</TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.similarity_score !== null ? entry.similarity_score.toFixed(2) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(entry.merged_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email history ({sendHistory?.length ?? 0})</CardTitle>
        </CardHeader>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!sendHistory || sendHistory.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No emails sent to this lead yet.
                </TableCell>
              </TableRow>
            )}
            {sendHistory?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-foreground">{entry.campaign_name}</TableCell>
                <TableCell className="text-muted-foreground">{entry.subject}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[entry.status] ?? "muted"} className="capitalize">
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.sent_at ? new Date(entry.sent_at).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
              {value}
            </a>
          ) : (
            <p className="break-all text-foreground">{value}</p>
          )
        ) : (
          <p className="text-muted-foreground/60">Not found</p>
        )}
      </CardContent>
    </Card>
  );
}

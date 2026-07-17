import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { fetchAuditLog } from "../lib/api";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Created user",
  "user.role_change": "Changed role",
  "user.delete": "Deleted user",
  "user.reset_password": "Reset password",
  "user.change_password": "Changed own password",
  "campaign.create": "Created campaign",
  "campaign.send": "Sent campaign",
  "campaign.exclude_lead": "Excluded lead",
  "campaign.include_lead": "Included lead",
};

function describeDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

export default function ActivityLogPage() {
  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ["audit-log"],
    queryFn: fetchAuditLog,
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">Activity</h1>
        <p className="text-sm text-muted-foreground">Audit trail of account and campaign actions</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-4 w-full max-w-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              {isError && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-destructive">
                    Failed to load activity log.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && entries?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
                        <History className="h-5 w-5" />
                      </div>
                      <p>No activity recorded yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {entries?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{entry.actor_email ?? "System"}</TableCell>
                  <TableCell className="text-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
                  <TableCell className="text-muted-foreground">{describeDetails(entry.details)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MapPin, TrendingUp, Users2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { fetchAnalyticsOverview } from "../lib/api";
import { useTheme } from "../lib/theme";

const SERIES_BLUE = "#01A4EF";

const CHART_COLORS = {
  dark: {
    gridline: "hsl(221 45% 17%)",
    muted: "hsl(215 20% 65%)",
    tooltipBg: "hsl(220 55% 10%)",
    tooltipBorder: "hsl(221 45% 20%)",
    tooltipText: "hsl(210 40% 98%)",
  },
  light: {
    gridline: "hsl(210 25% 88%)",
    muted: "hsl(215 15% 40%)",
    tooltipBg: "hsl(0 0% 100%)",
    tooltipBorder: "hsl(210 25% 88%)",
    tooltipText: "hsl(226 100% 7%)",
  },
};

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: fetchAnalyticsOverview,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) return <p className="text-destructive">Failed to load analytics.</p>;

  const matchRatePct = Math.round(data.enrichment_match_rate * 100);
  const highConfidencePct = Math.round(data.high_confidence_rate * 100);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Discovery volume, enrichment quality, and market coverage</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={MapPin} label="Listings discovered" value={data.total_listings} />
        <StatCard icon={Users2} label="Contacts attempted" value={data.total_contacts} />
        <StatCard icon={Users2} label="Leads (deduped)" value={data.total_leads} />
        <StatCard icon={TrendingUp} label="Enrichment match rate" value={`${matchRatePct}%`} />
        <StatCard icon={CheckCircle2} label="High confidence rate" value={`${highConfidencePct}%`} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Leads discovered over time</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          {data.leads_over_time.length === 0 ? (
            <p className="text-muted-foreground">No lead data yet.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data.leads_over_time} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.gridline} vertical={false} />
                  <XAxis dataKey="day" stroke={colors.muted} tick={{ fill: colors.muted, fontSize: 12 }} />
                  <YAxis
                    allowDecimals={false}
                    stroke={colors.muted}
                    tick={{ fill: colors.muted, fontSize: 12 }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 8,
                      color: colors.tooltipText,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Leads"
                    stroke={SERIES_BLUE}
                    strokeWidth={2}
                    dot={{ r: 4, fill: SERIES_BLUE }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market coverage</CardTitle>
        </CardHeader>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Listings</TableHead>
              <TableHead>Leads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.market_coverage.map((row) => (
              <TableRow key={`${row.city}-${row.state}`}>
                <TableCell className="font-medium text-foreground">
                  {row.city}, {row.state}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.listing_count}</TableCell>
                <TableCell className="text-muted-foreground">{row.lead_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-serif text-2xl text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

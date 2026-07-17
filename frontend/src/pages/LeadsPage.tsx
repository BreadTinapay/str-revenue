import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Clock, Download, Inbox, Mail, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ConfidenceBadge from "../components/ConfidenceBadge";
import LeadAvatar from "../components/LeadAvatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { MultiSelect } from "../components/ui/multi-select";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { downloadLeadsCsv, fetchLeads, fetchMarkets, type Lead, type LeadFilters } from "../lib/api";

const columnHelper = createColumnHelper<Lead>();

const CONFIDENCE_OPTIONS = [
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

export default function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<LeadFilters>(() => ({
    markets: searchParams.getAll("market"),
    confidence: searchParams.getAll("confidence"),
  }));
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);

  const { data: leads, isLoading, isError } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => fetchLeads(filters),
  });

  const { data: markets } = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
  });

  const marketOptions = useMemo(
    () => (markets ?? []).map((m) => ({ value: m.label, label: m.label })),
    [markets],
  );

  // Memoized: TanStack Table expects stable columns/data references across
  // renders. A fresh array/object identity every render (this previously
  // recreated `columns` inline and used `leads ?? []`, a new array literal
  // whenever `leads` was undefined) can put the table into a runaway
  // re-render loop that freezes the tab — confirmed via a render counter
  // that climbed into the tens of thousands after selecting a filter value.
  const columns = useMemo(
    () => [
      columnHelper.accessor("canonical_name", {
        header: "Name",
        cell: (info) => (
          <div className="flex items-center gap-3">
            <LeadAvatar name={info.getValue()} className="h-8 w-8" />
            <span className="font-medium text-foreground">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => `${row.city}, ${row.state}`, { id: "location", header: "Market" }),
      columnHelper.accessor("best_email", {
        header: "Email",
        cell: (info) =>
          info.getValue() ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {info.getValue()}
              </span>
              {info.row.original.is_suppressed && (
                <Badge variant="warning" title={info.row.original.suppression_reason ?? undefined}>
                  Opted out
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor("best_phone", {
        header: "Phone",
        cell: (info) =>
          info.getValue() ? (
            <span className="flex items-center gap-1.5 text-foreground">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {info.getValue()}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor("best_confidence_score", {
        header: "Confidence",
        cell: (info) => <ConfidenceBadge confidence={info.getValue()} />,
      }),
      columnHelper.accessor("listing_count", { header: "Listings" }),
      columnHelper.accessor("last_contacted_at", {
        header: "Last emailed",
        cell: (info) =>
          info.getValue() ? (
            <span className="flex items-center gap-1.5 text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {new Date(info.getValue()!).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-muted-foreground">Never</span>
          ),
      }),
      columnHelper.accessor("updated_at", {
        header: "Updated",
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    [],
  );

  const data = useMemo(() => leads ?? [], [leads]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Deduplicated hosts and companies across your markets</p>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-start gap-3 p-4">
          <div className="w-full space-y-1.5 sm:w-64">
            <Label>Markets</Label>
            <MultiSelect
              options={marketOptions}
              selected={filters.markets ?? []}
              onChange={(values) => setFilters((f) => ({ ...f, markets: values }))}
              placeholder="All markets"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-48">
            <Label>Confidence</Label>
            <MultiSelect
              options={CONFIDENCE_OPTIONS}
              selected={filters.confidence ?? []}
              onChange={(values) => setFilters((f) => ({ ...f, confidence: values }))}
              placeholder="All confidence levels"
            />
          </div>
          <Button variant="outline" className="ml-auto" onClick={() => downloadLeadsCsv(filters)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none hover:text-primary"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {isError && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-destructive">
                  Failed to load leads.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <p>No leads match these filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => navigate(`/leads/${row.original.id}`)}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

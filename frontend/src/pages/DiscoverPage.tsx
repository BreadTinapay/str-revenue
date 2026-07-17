import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MapPin, Plus, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import {
  fetchCities,
  fetchStates,
  getDedupJob,
  getDiscoveryJob,
  getEnrichmentJob,
  pollJob,
  triggerDedup,
  triggerDiscovery,
  triggerEnrichment,
} from "../lib/api";

interface MarketEntry {
  city: string;
  state: string;
}

type MarketStatus = "queued" | "discovering" | "enriching" | "deduping" | "done" | "failed";

interface MarketResult extends MarketEntry {
  status: MarketStatus;
  detail?: string;
}

const STATUS_LABEL: Record<MarketStatus, string> = {
  queued: "Queued",
  discovering: "Discovering listings...",
  enriching: "Enriching contacts...",
  deduping: "Deduplicating...",
  done: "Done",
  failed: "Failed",
};

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [queue, setQueue] = useState<MarketEntry[]>([]);
  const [results, setResults] = useState<MarketResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: states } = useQuery({ queryKey: ["us-states"], queryFn: fetchStates });

  const { data: cityOptions } = useQuery({
    queryKey: ["us-cities", stateCode, cityQuery],
    queryFn: () => fetchCities(stateCode, cityQuery || undefined),
    enabled: Boolean(stateCode),
  });

  const stateName = useMemo(() => states?.find((s) => s.code === stateCode)?.name ?? "", [states, stateCode]);

  function addToQueue() {
    if (!stateCode || !city.trim()) {
      setError("Pick a state and enter a city first.");
      return;
    }
    const exists = queue.some(
      (m) => m.state === stateCode && m.city.toLowerCase() === city.trim().toLowerCase(),
    );
    if (exists) {
      setError("That market is already in the queue.");
      return;
    }
    setError(null);
    setQueue((q) => [...q, { city: city.trim(), state: stateCode }]);
    setCity("");
    setCityQuery("");
  }

  function removeFromQueue(index: number) {
    setQueue((q) => q.filter((_, i) => i !== index));
  }

  async function runQueue() {
    if (queue.length === 0) {
      setError("Add at least one market to the queue first.");
      return;
    }
    setError(null);
    setRunning(true);
    const initial: MarketResult[] = queue.map((m) => ({ ...m, status: "queued" }));
    setResults(initial);

    for (let i = 0; i < queue.length; i++) {
      const market = queue[i];
      const update = (patch: Partial<MarketResult>) =>
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

      try {
        update({ status: "discovering" });
        const discoveryJob = await triggerDiscovery(market.city, market.state);
        const discoveryResult = await pollJob(getDiscoveryJob, discoveryJob.job_id);
        if (discoveryResult.status === "failed") {
          update({ status: "failed", detail: "Discovery failed — check the market has public listings." });
          continue;
        }

        update({ status: "enriching", detail: `${discoveryResult.result} listings found` });
        const enrichmentJob = await triggerEnrichment(market.city, market.state);
        const enrichmentResult = await pollJob(getEnrichmentJob, enrichmentJob.job_id);
        if (enrichmentResult.status === "failed") {
          update({ status: "failed", detail: "Enrichment failed." });
          continue;
        }

        update({ status: "deduping", detail: `${enrichmentResult.result} contacts attempted` });
        const dedupJob = await triggerDedup(market.city, market.state);
        const dedupResult = await pollJob(getDedupJob, dedupJob.job_id);
        if (dedupResult.status === "failed") {
          update({ status: "failed", detail: "Deduplication failed." });
          continue;
        }

        update({ status: "done", detail: `${dedupResult.result} listings processed into leads` });
      } catch {
        update({ status: "failed", detail: "Unexpected error." });
      }
    }

    setRunning(false);
  }

  const allDone = results.length > 0 && results.every((r) => r.status === "done" || r.status === "failed");
  const anySucceeded = results.some((r) => r.status === "done");

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">Discover Leads</h1>
        <p className="text-sm text-muted-foreground">
          Queue up one or more markets — any state, any city — and run discovery, enrichment, and deduplication
          across all of them in one go.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-full space-y-1.5 sm:w-56">
            <Label>State</Label>
            <Select value={stateCode} onValueChange={(v) => { setStateCode(v); setCity(""); setCityQuery(""); }} disabled={running}>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {states?.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-64">
            <Label>City</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                list="city-suggestions"
                placeholder={stateName ? `Any city in ${stateName}` : "Pick a state first"}
                className="pl-8"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setCityQuery(e.target.value);
                }}
                disabled={running || !stateCode}
              />
              <datalist id="city-suggestions">
                {cityOptions?.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <Button onClick={addToQueue} disabled={running} variant="secondary">
            <Plus className="h-4 w-4" />
            Add to queue
          </Button>
          <Button
            onClick={runQueue}
            disabled={running || queue.length === 0}
            size="lg"
            className="ml-auto shadow-glow"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              `Discover Leads${queue.length > 0 ? ` (${queue.length})` : ""}`
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {queue.length > 0 && results.length === 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Queued markets ({queue.length})</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-wrap gap-2 pt-4">
            {queue.map((m, i) => (
              <span
                key={`${m.city}-${m.state}-${i}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-sm text-foreground"
              >
                {m.city}, {m.state}
                <button type="button" onClick={() => removeFromQueue(i)} aria-label={`Remove ${m.city}, ${m.state}`}>
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline progress</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-5">
            {results.map((r, i) => (
              <div key={`${r.city}-${r.state}-${i}`} className="flex items-start gap-3">
                <StatusIcon status={r.status} />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {r.city}, {r.state}
                  </p>
                  <p className="text-sm text-muted-foreground">{r.detail ?? STATUS_LABEL[r.status]}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {allDone && anySucceeded && (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => navigate(`/leads`)}>View discovered leads</Button>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: MarketStatus }) {
  if (status === "done") return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />;
  if (status === "failed") return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />;
  if (status === "queued") return <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;
  return <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />;
}

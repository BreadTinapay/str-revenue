import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import { Badge } from "./ui/badge";

const CONFIG: Record<string, { variant: "success" | "warning" | "muted"; label: string; icon: typeof CheckCircle2 }> = {
  high: { variant: "success", label: "High", icon: CheckCircle2 },
  low: { variant: "warning", label: "Low", icon: TriangleAlert },
  none: { variant: "muted", label: "None", icon: CircleDashed },
};

export default function ConfidenceBadge({ confidence }: { confidence: string }) {
  const config = CONFIG[confidence] ?? CONFIG.none;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="capitalize">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

import { Laptop, Smartphone, Tablet } from "lucide-react";
import { useMemo, useState } from "react";

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<Device, number> = {
  desktop: 640,
  tablet: 480,
  mobile: 375,
};

const SAMPLE_CONTEXT: Record<string, string> = {
  name: "Jordan Lee",
  city: "Austin",
  state: "TX",
};

function interpolate(template: string): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => SAMPLE_CONTEXT[key] ?? `{{${key}}}`);
}

function buildDocument(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 15px;
        line-height: 1.6;
        color: #1a1a1a;
        background: #ffffff;
        word-wrap: break-word;
      }
      a { color: #01A4EF; }
      p { margin: 0 0 1em; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

interface EmailPreviewProps {
  subject: string;
  bodyHtml: string;
  fromLabel?: string;
}

export function EmailPreview({ subject, bodyHtml, fromLabel = "STR Revenue" }: EmailPreviewProps) {
  const [device, setDevice] = useState<Device>("desktop");
  const renderedSubject = useMemo(() => interpolate(subject), [subject]);
  const renderedBody = useMemo(() => buildDocument(interpolate(bodyHtml)), [bodyHtml]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Preview uses sample lead data — each real send is personalized per recipient.
        </p>
        <div className="flex gap-1 rounded-full border border-border bg-secondary/30 p-1">
          <DeviceButton
            icon={Laptop}
            active={device === "desktop"}
            onClick={() => setDevice("desktop")}
            label="Desktop"
          />
          <DeviceButton icon={Tablet} active={device === "tablet"} onClick={() => setDevice("tablet")} label="Tablet" />
          <DeviceButton
            icon={Smartphone}
            active={device === "mobile"}
            onClick={() => setDevice("mobile")}
            label="Mobile"
          />
        </div>
      </div>

      <div className="flex justify-center overflow-x-auto rounded-lg bg-muted/30 p-4 sm:p-6">
        <div
          className="overflow-hidden rounded-lg border border-border bg-white shadow-lg transition-[width] duration-200"
          style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}
        >
          <div className="border-b border-black/10 bg-[#f5f6f8] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[#0b1220]">{renderedSubject || "(No subject)"}</p>
            <p className="mt-0.5 truncate text-xs text-[#6b7280]">{fromLabel}</p>
          </div>
          <iframe
            title="Email preview"
            srcDoc={renderedBody}
            className="w-full border-0"
            style={{ height: 420 }}
            sandbox=""
          />
        </div>
      </div>
    </div>
  );
}

function DeviceButton({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: typeof Laptop;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

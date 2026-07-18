import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { UsState } from "../lib/api";

interface StatePickerProps {
  states: UsState[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export default function StatePicker({ states, value, onChange, disabled }: StatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? states.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.code.toLowerCase().includes(search.toLowerCase()),
      )
    : states;

  const selectedName = states.find((s) => s.code === value)?.name ?? "";

  useEffect(() => {
    if (open) {
      setSearch("");
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {selectedName || "Select a state"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search states..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">No states match your search</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    onChange(s.code);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

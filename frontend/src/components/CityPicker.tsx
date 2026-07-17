import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchCities } from "../lib/api";

const PAGE_SIZE = 50;

interface CityPickerProps {
  stateCode: string;
  stateName: string;
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
}

export default function CityPicker({ stateCode, stateName, value, onChange, disabled }: CityPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["us-cities", stateCode, debouncedSearch],
    queryFn: ({ pageParam = 0 }) => fetchCities(stateCode, debouncedSearch || undefined, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.cities.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
    enabled: open && Boolean(stateCode),
  });

  const cities = data?.pages.flatMap((p) => p.cities) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  useEffect(() => {
    if (open) {
      setSearch("");
      setDebouncedSearch("");
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
          {value || (stateName ? `Any city in ${stateName}` : "Pick a state first")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center border-b px-3">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search cities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : cities.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                {debouncedSearch ? "No cities match your search" : "No cities found"}
              </p>
            ) : (
              <>
                {cities.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground"
                  >
                    {c}
                  </button>
                ))}
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="flex w-full items-center justify-center gap-1 border-t px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load more (${cities.length} of ${totalCount})`
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

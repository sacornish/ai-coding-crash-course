import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

const STARS = [1, 2, 3, 4, 5];

export function RatingDisplay({
  average,
  count,
  className,
}: {
  average: number | null;
  count: number;
  className?: string;
}) {
  if (average === null || count === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        No ratings yet
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm", className)}
      aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count} ratings`}
    >
      <span className="font-semibold text-foreground">
        {average.toFixed(1)}
      </span>
      <span className="flex" aria-hidden>
        {STARS.map((star) => (
          <Star
            key={star}
            className={cn(
              "size-3.5",
              average >= star - 0.5
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </span>
  );
}

export function RatingInput({ currentRating }: { currentRating: number | null }) {
  const fetcher = useFetcher<{ error?: string }>();
  const [hovered, setHovered] = useState<number | null>(null);

  const pending = fetcher.formData?.get("rating");
  const selected = pending ? Number(pending) : currentRating;
  const shown = hovered ?? selected ?? 0;

  return (
    <fetcher.Form method="post" className="space-y-1">
      <input type="hidden" name="intent" value="rate" />
      <div className="text-sm font-medium">
        {currentRating ? "Your rating" : "Rate this course"}
      </div>
      <div
        className="flex"
        role="radiogroup"
        aria-label="Course rating"
        onMouseLeave={() => setHovered(null)}
      >
        {STARS.map((star) => (
          <button
            key={star}
            type="submit"
            name="rating"
            value={star}
            role="radio"
            aria-checked={selected === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            disabled={fetcher.state !== "idle"}
            className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                star <= shown
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
      {fetcher.data?.error && (
        <p className="text-xs text-destructive">{fetcher.data.error}</p>
      )}
    </fetcher.Form>
  );
}

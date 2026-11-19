import { useEffect, useRef } from "react";
import { Button } from "../../../../components/ui/Button";

export function CatalogLoadMore({ query, loadedCount }) {
  const sentinel = useRef(null);
  const { hasNextPage, isFetching, isFetchingNextPage, isError, fetchNextPage } = query;

  useEffect(() => {
    if (!hasNextPage || isFetching || isError || !window.IntersectionObserver) return;

    let requested = false;
    const observer = new IntersectionObserver((entries) => {
      if (!requested && entries.some((entry) => entry.isIntersecting)) {
        requested = true;
        void fetchNextPage({ cancelRefetch: false });
      }
    }, { rootMargin: "400px" });
    observer.observe(sentinel.current);
    return () => {
      requested = true;
      observer.disconnect();
    };
  }, [hasNextPage, isFetching, isError, fetchNextPage]);

  return (
    <div ref={sentinel} className="catalog-load-more">
      <p aria-live="polite">
        {isFetchingNextPage
          ? "Loading more products…"
          : !hasNextPage && loadedCount > 0
            ? "You've reached the end of the catalog."
            : null}
      </p>
      {isError && <p role="alert">Couldn't load more products. Your loaded products are still here.</p>}
      {hasNextPage && (
        <Button
          disabled={isFetching}
          onClick={() => fetchNextPage({ cancelRefetch: false })}
        >
          {isError ? "Retry loading products" : "Load more products"}
        </Button>
      )}
    </div>
  );
}

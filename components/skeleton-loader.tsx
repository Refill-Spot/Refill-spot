export function StoreListSkeleton() {
  return (
    <div className="h-full bg-card" role="status" aria-busy="true">
      <span className="sr-only">가게 목록을 불러오는 중입니다.</span>
      <div aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex gap-3 border-b border-border px-4 py-4 motion-safe:animate-pulse"
          >
            <div className="order-2 mt-10 h-16 w-16 flex-shrink-0 rounded-sm bg-muted" />
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center justify-between gap-3">
                <div className="h-4 w-3/4 rounded-sm bg-muted" />
                <div className="h-4 w-4 flex-shrink-0 rounded-sm bg-muted" />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <div className="h-3 w-1/2 rounded-sm bg-muted" />
                <div className="h-6 w-1/2 rounded-sm bg-muted" />
              </div>
              <div className="mt-1.5 flex h-4 items-center gap-3">
                <div className="h-3 w-2/5 rounded-sm bg-muted" />
                <div className="h-3 w-1/5 rounded-sm bg-muted" />
              </div>
              <div className="mt-1.5 h-4 w-5/6 rounded-sm bg-muted" />
              <div className="mt-2 h-9 w-1/3 rounded-sm bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

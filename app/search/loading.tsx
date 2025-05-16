import { Skeleton } from "@/components/ui/skeleton";
import ViewToggle from "@/components/view-toggle";

export default function Loading() {
  return (
    <main className="flex flex-col h-screen bg-[#F5F5F5]">
      {/* 헤더 스켈레톤 */}
      <div className="w-full bg-white border-b border-gray-200 py-3 px-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-2/3 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* 뷰 토글 스켈레톤 */}
      <div className="flex justify-center py-2 bg-white border-b border-gray-200">
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 스켈레톤 (데스크톱) */}
        <div className="hidden md:block w-80 border-r border-gray-200 overflow-y-auto p-4">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-8 w-1/2 mb-3" />
          <div className="space-y-2 mb-6">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
          </div>
          <Skeleton className="h-8 w-1/2 mb-3" />
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-10 w-full mb-3" />
        </div>

        {/* 지도/목록 영역 스켈레톤 */}
        <div className="flex-1 relative p-4">
          <div className="h-full flex flex-col">
            {/* 지도 로딩 스켈레톤 */}
            <Skeleton className="h-full w-full rounded-md" />

            {/* 모바일 하단 시트 스켈레톤 */}
            <div className="md:hidden absolute bottom-0 left-0 right-0 px-4 py-2">
              <Skeleton className="h-20 w-full rounded-t-lg" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

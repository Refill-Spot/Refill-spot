import { Card, CardContent } from "@/components/ui/card";

export function StoreListSkeleton() {
  return (
    <div className="h-full bg-[#F5F5F5] p-4">
      <div className="space-y-4 pr-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <div className="flex md:flex-row flex-col">
              <div className="md:w-32 w-full h-32 bg-gray-200 flex-shrink-0"></div>
              <CardContent className="flex-1 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="h-6 bg-gray-200 rounded w-32"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

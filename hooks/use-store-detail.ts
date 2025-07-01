"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { Store } from "@/types/store";
import { useEffect, useState } from "react";

export function useStoreDetail(storeId: number | string) {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchStoreDetail = async () => {
      if (!storeId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/stores/${storeId}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const response_data = await response.json();

        if (response_data.error) {
          throw new Error(response_data.error);
        }

        setStore(response_data.data);
      } catch (err) {
        console.error("가게 상세 정보 로드 오류:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);

        toast({
          title: t("store_detail_error"),
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStoreDetail();
  }, [storeId, toast, t]);

  return { store, loading, error };
}

"use client";

import { useState, useEffect } from "react";
import { Store } from "@/types/store";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

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

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setStore(data);
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

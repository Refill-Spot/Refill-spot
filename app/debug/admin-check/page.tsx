"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminCheckDebugPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkAdmin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/check-admin');
      const data = await response.json();
      setResult({
        status: response.status,
        success: data.success,
        data: data.data || data,
        error: data.error,
      });
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>관리자 권한 디버그</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={checkAdmin} disabled={loading}>
            {loading ? "확인 중..." : "관리자 권한 확인"}
          </Button>
          
          {result && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">결과:</h3>
              <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";

interface Store {
  id: number;
  name: string;
  address: string;
  position_lat: number;
  position_lng: number;
  naver_rating?: number;
  kakao_rating?: number;
}

export default function DebugStoresPage() {
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [gangnamStores, setGangnamStores] = useState<Store[]>([]);
  const [apiStores, setApiStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        console.log("🔍 디버그 데이터 수집 시작...");

        // 1. 강남구 가게 직접 조회
        console.log("1️⃣ 강남구 가게 테스트 API 호출...");
        const gangnamResponse = await fetch("/api/stores/test");
        const gangnamData = await gangnamResponse.json();
        console.log("강남구 가게 응답:", gangnamData);
        setGangnamStores(gangnamData.stores || []);

        // 2. 전체 가게 목록 조회 (위치 파라미터 없이)
        console.log("2️⃣ 전체 가게 목록 API 호출...");
        const allResponse = await fetch("/api/stores");
        const allData = await allResponse.json();
        console.log("전체 가게 응답:", allData);
        setApiStores(allData.data || []);

        // 3. 강남구 좌표로 필터링된 가게 조회
        console.log("3️⃣ 강남구 좌표로 필터링된 가게 API 호출...");
        const filteredResponse = await fetch(
          "/api/stores?lat=37.5006249&lng=127.0277083&radius=10&page=1&limit=50"
        );
        const filteredData = await filteredResponse.json();
        console.log("필터링된 가게 응답:", filteredData);

        // 4. 원본 데이터베이스 직접 조회 (Supabase)
        console.log("4️⃣ 원본 데이터베이스 직접 조회...");
        // 이건 클라이언트에서는 할 수 없으므로 서버 API를 통해 조회

      } catch (err) {
        console.error("디버그 데이터 수집 오류:", err);
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    };

    fetchDebugData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">가게 데이터 디버깅 중...</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">오류 발생</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">🔍 가게 데이터 디버깅 페이지</h1>
      
      {/* 요약 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="font-bold text-blue-800">강남구 가게 (DB 직접 조회)</h3>
          <p className="text-2xl font-bold text-blue-600">{gangnamStores.length}개</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="font-bold text-green-800">전체 가게 (API)</h3>
          <p className="text-2xl font-bold text-green-600">{apiStores.length}개</p>
        </div>
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="font-bold text-purple-800">현재 문제</h3>
          <p className="text-lg text-purple-600">
            {gangnamStores.length > apiStores.length ? "데이터 손실 발생" : "정상"}
          </p>
        </div>
      </div>

      {/* 강남구 가게 목록 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">📍 강남구 가게 목록 ({gangnamStores.length}개)</h2>
        <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
          {gangnamStores.map((store, index) => (
            <div key={store.id} className="border-b border-gray-200 py-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{index + 1}. {store.name}</span>
                  <span className="text-gray-600 ml-2">({store.address})</span>
                </div>
                <div className="text-sm text-gray-500">
                  위치: {store.position_lat}, {store.position_lng}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API로 가져온 가게 목록 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">🌐 API로 가져온 가게 목록 ({apiStores.length}개)</h2>
        <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
          {apiStores.map((store, index) => (
            <div key={store.id} className="border-b border-gray-200 py-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{index + 1}. {store.name}</span>
                  <span className="text-gray-600 ml-2">({store.address})</span>
                </div>
                <div className="text-sm text-gray-500">
                  위치: {store.position?.lat}, {store.position?.lng}
                  {store.distance && <span className="ml-2">거리: {store.distance}km</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 좌표별 가게 분포 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">📊 좌표별 가게 분포</h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">강남구 가게 좌표 범위:</h3>
          {gangnamStores.length > 0 && (
            <div className="text-sm text-gray-700">
              <p>위도 범위: {Math.min(...gangnamStores.map(s => s.position_lat)).toFixed(6)} ~ {Math.max(...gangnamStores.map(s => s.position_lat)).toFixed(6)}</p>
              <p>경도 범위: {Math.min(...gangnamStores.map(s => s.position_lng)).toFixed(6)} ~ {Math.max(...gangnamStores.map(s => s.position_lng)).toFixed(6)}</p>
            </div>
          )}
        </div>
      </div>

      {/* 테스트 링크들 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">🔗 테스트 링크들</h2>
        <div className="space-y-2">
          <div>
            <a 
              href="/api/stores/test" 
              target="_blank" 
              className="text-blue-600 hover:underline"
            >
              강남구 가게 테스트 API
            </a>
          </div>
          <div>
            <a 
              href="/api/stores" 
              target="_blank" 
              className="text-blue-600 hover:underline"
            >
              전체 가게 목록 API
            </a>
          </div>
          <div>
            <a 
              href="/api/stores?lat=37.5006249&lng=127.0277083&radius=10&page=1&limit=50" 
              target="_blank" 
              className="text-blue-600 hover:underline"
            >
              강남구 좌표 필터링 API
            </a>
          </div>
        </div>
      </div>

      {/* 디버깅 정보 */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-bold text-yellow-800 mb-2">🐛 디버깅 정보</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <p>• 강남구 가게 수: {gangnamStores.length}개</p>
          <p>• API로 가져온 가게 수: {apiStores.length}개</p>
          <p>• 데이터 불일치: {gangnamStores.length !== apiStores.length ? "있음" : "없음"}</p>
          <p>• 현재 시간: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
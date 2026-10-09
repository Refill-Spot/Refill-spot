const SDK_TIMEOUT_MS = 10_000;
const SDK_URL = "https://dapi.kakao.com/v2/maps/sdk.js";

let loadingPromise: Promise<any> | null = null;

function currentMaps(): any {
  return (window as Window & { kakao?: any }).kakao?.maps;
}

function isReady(maps: any): boolean {
  return (
    typeof maps?.Map === "function" &&
    typeof maps?.services?.Places === "function" &&
    typeof maps?.services?.Geocoder === "function" &&
    typeof maps?.MarkerClusterer === "function"
  );
}

export function loadKakaoMaps(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error("카카오 지도는 브라우저에서만 사용할 수 있습니다."),
    );
  }

  const key = process.env.NEXT_PUBLIC_KAKAO_API_KEY?.trim();
  if (!key || !/^[a-f0-9]{32}$/i.test(key)) {
    return Promise.reject(
      new Error("카카오 지도 JavaScript API 키를 올바르게 설정해주세요."),
    );
  }

  if (loadingPromise) {
    return loadingPromise;
  }
  if (isReady(currentMaps())) {
    return Promise.resolve(currentMaps());
  }

  const promise = new Promise<any>((resolve, reject) => {
    let script: HTMLScriptElement | null = null;
    let ownsScript = false;
    let settled = false;
    let initializing = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      script?.removeEventListener("load", initialize);
      script?.removeEventListener("error", handleError);
      if (error) {
        if (ownsScript) {
          script?.remove();
        }
        reject(error);
      } else {
        resolve(currentMaps());
      }
    };

    const initialize = () => {
      if (settled || initializing) {
        return;
      }
      const maps = currentMaps();
      if (isReady(maps)) {
        finish();
        return;
      }
      if (typeof maps?.load !== "function") {
        finish(new Error("카카오 지도 SDK 초기화에 실패했습니다."));
        return;
      }
      initializing = true;
      try {
        maps.load(() => {
          if (isReady(currentMaps())) {
            finish();
          } else {
            finish(
              new Error(
                "카카오 지도 검색 또는 클러스터 라이브러리를 불러오지 못했습니다.",
              ),
            );
          }
        });
      } catch {
        finish(new Error("카카오 지도 SDK 초기화에 실패했습니다."));
      }
    };

    const handleError = () => {
      finish(
        new Error(
          "카카오 지도 SDK를 불러오지 못했습니다. 네트워크와 앱 설정을 확인해주세요.",
        ),
      );
    };

    const timeout = setTimeout(() => {
      const error = new Error(
        "카카오 지도 SDK 로딩 시간이 초과되었습니다. 다시 시도해주세요.",
      );
      error.name = "TimeoutError";
      finish(error);
    }, SDK_TIMEOUT_MS);

    try {
      script =
        Array.from(document.scripts).find((candidate) => {
          try {
            const url = new URL(candidate.src, document.baseURI);
            return (
              url.hostname === "dapi.kakao.com" &&
              url.pathname === "/v2/maps/sdk.js"
            );
          } catch {
            return false;
          }
        }) ?? null;

      if (!script) {
        script = document.createElement("script");
        script.src = `${SDK_URL}?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services,clusterer`;
        script.async = true;
        ownsScript = true;
      }

      script.addEventListener("load", initialize);
      script.addEventListener("error", handleError);
      if (ownsScript) {
        document.head.appendChild(script);
      } else if (
        typeof currentMaps()?.load === "function" ||
        isReady(currentMaps())
      ) {
        initialize();
      }
    } catch {
      handleError();
    }
  });

  loadingPromise = promise;
  const clearPending = () => {
    if (loadingPromise === promise) {
      loadingPromise = null;
    }
  };
  void promise.then(clearPending, clearPending);
  return promise;
}

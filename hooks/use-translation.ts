"use client";

import { useEffect, useMemo, useState } from "react";

// 지원 언어 정의
export type SupportedLocale = "ko" | "en";

// 번역 타입 정의 (JSON 파일 구조와 일치)
type Translations = Record<string, string>;

// 번역 로더 함수
const loadTranslations = async (locale: SupportedLocale): Promise<Translations> => {
  try {
    const response = await fetch(`/locales/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${locale}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading translations for ${locale}:`, error);
    // 기본 한국어 번역을 fallback으로 사용
    if (locale !== "ko") {
      return loadTranslations("ko");
    }
    // 최후의 fallback
    return {};
  }
};

export function useTranslation() {
  // 기본 언어는 한국어
  const [locale, setLocale] = useState<SupportedLocale>("ko");
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);

  // 브라우저 언어 감지 및 번역 로드
  useEffect(() => {
    const detectAndLoadLanguage = async () => {
      setIsLoading(true);
      
      // 브라우저 언어 감지
      const browserLocale = navigator.language.split("-")[0] as SupportedLocale;
      const targetLocale = browserLocale === "en" ? "en" : "ko";
      
      setLocale(targetLocale);
      
      // 번역 로드
      const loadedTranslations = await loadTranslations(targetLocale);
      setTranslations(loadedTranslations);
      setIsLoading(false);
    };

    detectAndLoadLanguage();
  }, []);

  // 언어 변경 시 번역 재로드
  useEffect(() => {
    const loadLocaleTranslations = async () => {
      if (locale) {
        setIsLoading(true);
        const loadedTranslations = await loadTranslations(locale);
        setTranslations(loadedTranslations);
        setIsLoading(false);
      }
    };

    if (locale) {
      loadLocaleTranslations();
    }
  }, [locale]);

  // 번역 함수
  const t = (key: string, params?: Record<string, string>) => {
    // 해당 키에 대한 번역 가져오기
    let translation = translations[key] || key;

    // 파라미터가 있으면 치환
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value);
      });
    }

    return translation;
  };

  // 언어 변경 함수
  const changeLocale = (newLocale: SupportedLocale) => {
    if (newLocale !== locale) {
      setLocale(newLocale);
    }
  };

  return {
    t,
    locale,
    changeLocale,
    isLoading,
  };
}

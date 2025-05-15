"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 text-red-800">
            <h2 className="text-2xl font-bold mb-4">오류가 발생했습니다</h2>
            <p className="mb-4">
              {this.state.error?.message || "알 수 없는 오류가 발생했습니다."}
            </p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              다시 시도
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children, fallback }: Props) {
  const { t } = useTranslation();

  const defaultFallback = (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 text-red-800">
      <h2 className="text-2xl font-bold mb-4">{t("error_occurred")}</h2>
      <p className="mb-4">{t("try_again_message")}</p>
      <Button
        onClick={() => window.location.reload()}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        {t("try_again")}
      </Button>
    </div>
  );

  return (
    <ErrorBoundaryClass fallback={fallback || defaultFallback}>
      {children}
    </ErrorBoundaryClass>
  );
}

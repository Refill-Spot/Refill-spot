import { NextResponse } from "next/server";

export type ApiError = {
  code: string;
  message: string;
  details?: any;
};

export function errorResponse(error: string | ApiError, status: number = 500) {
  const errorObj =
    typeof error === "string" ? { code: "error", message: error } : error;

  return NextResponse.json({ success: false, error: errorObj }, { status });
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

// API 파일들에서 사용하는 apiResponse 객체
export const apiResponse = {
  success: successResponse,
  error: errorResponse,
};

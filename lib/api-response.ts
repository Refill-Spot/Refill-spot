import { NextResponse } from "next/server";

export type ApiError = {
  code: string;
  message: string;
  details?: any;
};

export function errorResponse(error: string | ApiError, status: number = 500) {
  const errorObj =
    typeof error === "string" ? { code: "error", message: error } : error;

  return NextResponse.json({ error: errorObj }, { status });
}

export function successResponse<T>(data: T) {
  return NextResponse.json(data);
}

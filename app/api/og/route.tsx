import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 요청 파라미터 가져오기
    const title = searchParams.get("title") || "무한리필 맛집";
    const category = searchParams.get("category") || "";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            backgroundImage:
              "linear-gradient(to bottom right, #FF5722, #FFAB91)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "32px 64px",
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)",
              maxWidth: "80%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF5722"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "16px" }}
              >
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: "bold",
                  color: "#FF5722",
                }}
              >
                Refill-spot
              </span>
            </div>
            <h1
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: "#333333",
                margin: "0 0 20px 0",
                textAlign: "center",
              }}
            >
              {title}
            </h1>
            {category && (
              <p
                style={{
                  fontSize: "24px",
                  color: "#666666",
                  margin: "0",
                  textAlign: "center",
                }}
              >
                {category}
              </p>
            )}
            <p
              style={{
                fontSize: "20px",
                color: "#999999",
                margin: "20px 0 0 0",
                textAlign: "center",
              }}
            >
              무한리필 맛집 찾기 | 리필스팟
            </p>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`OG 이미지 생성 중 오류 발생: ${e.message}`, {
      status: 500,
    });
  }
}

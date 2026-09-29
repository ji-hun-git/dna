import "../font-bundle";
import "@gc/design-tokens/tokens.css";
import "./globals.css";
import "./product.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "앎 — 건강 기록",
    template: "%s · 앎",
  },
  description: "검사 결과를 모아 보고 원본 결과지와 수정 내역을 확인하는 건강 기록 서비스",
};

const applicationId = "genome-companion-korea-web";
const applicationInstance = process.env.GC_APPLICATION_INSTANCE_ID ?? "local-unverified-instance";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body className="gc-product" data-application-id={applicationId} data-application-instance={applicationInstance}>{children}</body>
    </html>
  );
}

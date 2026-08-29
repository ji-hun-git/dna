import "../font-bundle";
import "@gc/design-tokens/tokens.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "앎 — 내 건강 기록의 출처까지",
    template: "%s · 앎",
  },
  description: "흩어진 건강 기록을 출처와 확인 이력까지 함께 관리하는 개인 건강 기록 서비스",
};

const applicationId = "genome-companion-korea-web";
const applicationInstance = process.env.GC_APPLICATION_INSTANCE_ID ?? "local-unverified-instance";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body data-application-id={applicationId} data-application-instance={applicationInstance}>{children}</body>
    </html>
  );
}

import "../font-bundle";
import "@gc/design-tokens/tokens.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "앎 연구근거실", template: "%s · 앎 연구근거실" },
  description: "개인 건강정보 없이 공개 연구 메타데이터의 출처와 이용 조건을 검토하는 별도 연구 제품",
};

export default function ResearchRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body data-application-id="genome-companion-research-web" data-trust-plane="public-research">
        {children}
      </body>
    </html>
  );
}

import "../font-bundle";
import "@gc/design-tokens/tokens.css";
import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

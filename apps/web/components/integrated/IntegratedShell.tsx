"use client";

import type { ReactNode } from "react";

export type IntegratedRoute = "home" | "records" | "prepare" | "data-control";

// One ordered menu for every integrated screen, so the printable visit sheet is
// reachable from the same place as the records list.
const routes: ReadonlyArray<{ key: IntegratedRoute; href: string; label: string }> = [
  { key: "home", href: "/", label: "홈" },
  { key: "records", href: "/records", label: "기록" },
  { key: "prepare", href: "/prepare", label: "진료 준비" },
  { key: "data-control", href: "/data-control", label: "데이터 관리" },
];

type IntegratedShellProps = {
  current: IntegratedRoute;
  status?: string;
  children: ReactNode;
};

/**
 * The shared app bar. It carries the brand, the four product routes and an
 * optional server-state pill; it never shows a health value or a judgement.
 */
export function IntegratedShell({ current, status, children }: IntegratedShellProps) {
  return (
    <>
      <header className="gc-shell">
        <div className="gc-shell__bar">
          <a className="gc-shell__brand" href="/" aria-label="앎 건강 홈">
            <span aria-hidden="true">앎</span>
            <strong>앎</strong>
          </a>
          <nav className="gc-shell__nav" aria-label="주요 메뉴">
            {routes.map((route) => (
              <a
                key={route.key}
                href={route.href}
                aria-current={route.key === current ? "page" : undefined}
              >
                {route.label}
              </a>
            ))}
          </nav>
          {status ? <span className="gc-shell__status">{status}</span> : null}
        </div>
      </header>
      {children}
    </>
  );
}

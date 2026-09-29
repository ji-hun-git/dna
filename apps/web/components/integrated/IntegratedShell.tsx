"use client";

import type { ReactNode } from "react";

export type IntegratedRoute = "home" | "my-data" | "records" | "history" | "prepare" | "data-control";

type NavKey = "home" | "my-data" | "prepare" | "data-control";

// Stable task destinations, with the three record views grouped together.
const routes: ReadonlyArray<{ key: NavKey; href: string; label: string }> = [
  { key: "home", href: "/", label: "홈" },
  { key: "my-data", href: "/my-data", label: "나의 데이터" },
  { key: "prepare", href: "/prepare", label: "진료 준비" },
  { key: "data-control", href: "/data-control", label: "데이터 관리" },
];

const navGroup: Record<IntegratedRoute, NavKey | null> = {
  home: "home",
  "my-data": "my-data",
  records: "my-data",
  history: "my-data",
  prepare: "prepare",
  "data-control": "data-control",
};

// Original line drawings follow the existing 24px SVG convention. The written
// label owns the accessible name; an icon never adds a second tab stop.
const routeIconPaths: Record<NavKey, string> = {
  home: "M3 11l9-8 9 8M5 10v11h5v-7h4v7h5V10",
  prepare: "M8 5H5v16h14V5h-3M8 3h8v4H8zM8 12h8M8 16h5",
  "my-data": "M4 18h16M6 14h2v4H6zM10 10h2v8h-2zM14 12h2v6h-2zM18 6h2v12h-2z",
  "data-control": "M4 6h5m4 0h7M4 12h9m4 0h3M4 18h3m4 0h9M9 4v4m4 2v4m-6 2v4",
};

type IntegratedShellProps = {
  current: IntegratedRoute;
  status?: string;
  children: ReactNode;
};

/**
 * The shared app bar. It carries the brand, stable task destinations and
 * an optional server-state pill; it never shows a health value or a judgement.
 */
export function IntegratedShell({ current, status, children }: IntegratedShellProps) {
  const header = (
    <header className="gc-shell gc-shell--unified">
      <div className="gc-shell__bar">
        <a className="gc-shell__brand" href="/" aria-label="앎 건강 홈">
          <strong>앎<span aria-hidden="true">.</span></strong>
          <span className="gc-shell__brand-caption">나를 알아가는 기록</span>
        </a>
        <nav className="gc-shell__nav" aria-label="주요 메뉴">
          {routes.map((route) => (
            <a
              key={route.key}
              href={route.href}
              aria-current={route.key === navGroup[current] ? "page" : undefined}
            >
              <svg className="gc-shell__nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d={routeIconPaths[route.key]} />
              </svg>
              <span>{route.label}</span>
            </a>
          ))}
        </nav>
        {status ? <span className="gc-shell__status"><i aria-hidden="true" />{status}</span> : null}
      </div>
      {navGroup[current] === "my-data" && (
        <nav className="gc-view-nav" aria-label="기록 보기 방식">
          {([
            ["my-data", "/my-data", "한눈에 보기"],
            ["records", "/records", "기록 목록"],
            ["history", "/my-data/history", "측정 이력"],
          ] as const).map(([key, href, label]) => (
            <a key={key} href={href} aria-current={current === key ? "page" : undefined}>{label}</a>
          ))}
        </nav>
      )}
    </header>
  );

  return (
    <>
      {header}
      {children}
    </>
  );
}

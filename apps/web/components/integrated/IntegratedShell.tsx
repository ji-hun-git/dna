"use client";

import type { ReactNode } from "react";

export type IntegratedRoute = "home" | "my-data" | "records" | "prepare" | "data-control";

type NavKey = "my-data" | "data-control";

// Two destinations: everything a person looks at, and everything a person
// manages. Records and preparation are sections of the first.
const routes: ReadonlyArray<{ key: NavKey; href: string; label: string }> = [
  { key: "my-data", href: "/my-data", label: "나의 데이터" },
  { key: "data-control", href: "/data-control", label: "데이터 관리" },
];

const navGroup: Record<IntegratedRoute, NavKey | null> = {
  home: null,
  "my-data": "my-data",
  records: "my-data",
  prepare: "my-data",
  "data-control": "data-control",
};

// Original line drawings follow the existing 24px SVG convention. The written
// label owns the accessible name; an icon never adds a second tab stop.
const routeIconPaths: Record<NavKey, string> = {
  "my-data": "M4 18h16M6 14h2v4H6zM10 10h2v8h-2zM14 12h2v6h-2zM18 6h2v12h-2z",
  "data-control": "M4 6h5m4 0h7M4 12h9m4 0h3M4 18h3m4 0h9M9 4v4m4 2v4m-6 2v4",
};

type IntegratedShellProps = {
  current: IntegratedRoute;
  status?: string;
  children: ReactNode;
};

/**
 * The shared app bar. It carries the brand, the two product destinations and
 * an optional server-state pill; it never shows a health value or a judgement.
 */
export function IntegratedShell({ current, status, children }: IntegratedShellProps) {
  return (
    <>
      <header className="gc-shell gc-shell--unified">
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
                aria-current={route.key === navGroup[current] ? "page" : undefined}
              >
                <svg className="gc-shell__nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d={routeIconPaths[route.key]} />
                </svg>
                <span>{route.label}</span>
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

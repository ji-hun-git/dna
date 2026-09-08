"use client";

import type { ReactNode } from "react";

export type IntegratedRoute = "home" | "records" | "prepare" | "data-control";

// One ordered menu for every integrated screen, so the printable visit sheet is
// reachable from the same place as the records list.
const routes: ReadonlyArray<{ key: IntegratedRoute; href: string; label: string }> = [
  { key: "home", href: "/", label: "홈" },
  { key: "records", href: "/records", label: "기록" },
  { key: "prepare", href: "/prepare", label: "진료 준비" },
  { key: "data-control", href: "/data-control", label: "데이터" },
];

// Original line drawings follow the existing 24px SVG convention. The written
// label owns the accessible name; an icon never adds a second tab stop.
const routeIconPaths: Record<IntegratedRoute, string> = {
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  records: "M7 3h10l3 3v15H7V3ZM7 7H3v14M11 9h5M11 13h5M11 17h3",
  prepare: "M9 5H5v16h14V5h-4M9 3h6v4H9V3Zm0 10 2 2 4-4M9 18h6",
  "data-control": "M4 6h5m4 0h7M4 12h9m4 0h3M4 18h3m4 0h9M9 4v4m4 2v4m-6 2v4",
};

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
                aria-current={route.key === current ? "page" : undefined}
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

import type { ReactNode } from "react";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { EXAMPLE_IDENTITY, RINGS, exampleRecordRows, nodeValueWithUnit, type ExampleNode, type ExampleRing } from "@/lib/home/alive-example-data";
import { buildExamplePhases } from "@/lib/home/alive-home-data";
import { AliveTrajectory } from "@/components/home/AliveTrajectory";
import styles from "@/components/home/AliveEntryLayout.module.css";

// No phase is ever empty by construction: derived once from the example rings' own node dates,
// not a hand-picked label list that could drift out of sync with the data.
const EXAMPLE_PHASES = buildExamplePhases(RINGS);

export type AliveIdentity = {
  name: string;
  age: number | string;
  gender: string;
  /** null renders "없음" (no real-looking date is ever fabricated for a session with no history). */
  lastResultDate: string | null;
  recordCount: number;
  resultSheetCount: number;
};

function IdentityPanel({ identity }: { identity: AliveIdentity }) {
  return (
    <div className={styles.panel} aria-labelledby="alive-identity-title">
      <p className={styles.panelTitle} id="alive-identity-title">
        프로필 · 예시
      </p>
      <dl className={styles.identityList}>
        <div>
          <dt>이름</dt>
          <dd>{identity.name}</dd>
        </div>
        <div>
          <dt>나이</dt>
          <dd>{identity.age}</dd>
        </div>
        <div>
          <dt>성별</dt>
          <dd>{identity.gender}</dd>
        </div>
        <div>
          <dt>최근 결과지</dt>
          <dd>{identity.lastResultDate ? formatKoreanDate(identity.lastResultDate) : "없음"}</dd>
        </div>
        <div>
          <dt>기록</dt>
          <dd>{identity.recordCount}개</dd>
        </div>
        <div>
          <dt>결과지</dt>
          <dd>{identity.resultSheetCount}개</dd>
        </div>
      </dl>
      <p className={styles.identityNote}>이 프로필은 예시이며 실제 사람의 정보가 아니에요.</p>
    </div>
  );
}

export type AliveRecordsAction = { label: string; href: string };

type RecordsPanelProps = {
  title: string;
  heading?: string;
  rows: ExampleNode[];
  zeroMessage?: string;
  action?: AliveRecordsAction;
  below?: ReactNode;
};

function RecordsPanel({ title, heading, rows, zeroMessage, action, below }: RecordsPanelProps) {
  const titleId = "alive-records-title";
  return (
    <div className={styles.panel} aria-labelledby={titleId}>
      <p className={styles.panelTitle} id={titleId}>
        {title}
      </p>
      {heading && <h2 className={styles.panelHeading}>{heading}</h2>}
      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">값</th>
                <th scope="col">검사일</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((node, i) => (
                <tr key={`${node.item}-${i}`}>
                  <td>{node.item}</td>
                  <td>{nodeValueWithUnit(node)}</td>
                  <td>{formatKoreanDate(node.observedOn)}</td>
                  <td>직접 확인함</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        zeroMessage && <p className={styles.identityNote}>{zeroMessage}</p>
      )}
      {action && (
        <a className={styles.panelAction} href={action.href}>
          {action.label}
        </a>
      )}
      {below}
    </div>
  );
}

function PhaseStrip({ labels, currentIndex }: { labels: readonly string[]; currentIndex: number }) {
  return (
    <nav className={styles.phaseStrip} aria-label="검진 시기">
      {labels.map((label, i) => (
        <div className={styles.phaseStripItem} key={`${label}-${i}`}>
          <span
            className={[styles.phaseMarker, i === currentIndex ? styles.phaseMarkerCurrent : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
          <span className={styles.phaseStripLabel}>
            {label}
            {i === currentIndex ? " · 현재" : ""}
          </span>
        </div>
      ))}
    </nav>
  );
}

export type AliveEntryLayoutProps = {
  /** The left column's top block: the pre-login copy, or the logged-in actions panel. */
  children: ReactNode;
  identity?: AliveIdentity;
  recordsTitle?: string;
  recordsHeading?: string;
  rows?: ExampleNode[];
  recordsZeroMessage?: string;
  recordsAction?: AliveRecordsAction;
  /** Rendered under the records table/empty-state inside the same panel (e.g. RecentChanges). */
  belowRecords?: ReactNode;
  /** A second panel stacked under the records panel in the right column (e.g. the boundary strip). */
  rightExtra?: ReactNode;
  rings?: ReadonlyArray<ExampleRing>;
  phaseLabels?: readonly string[];
  currentPhaseIndex?: number;
  heroCaption?: string;
};

/**
 * The dense, gridded trajectory composition shared by the pre-login entry screen and the
 * logged-in home screen: a copy/actions block and an identity panel in the left column, the
 * alive-trajectory hero owning the centre, a records panel (plus an optional second panel) on the
 * right, and a phase strip along the bottom. Under ~900px it stacks: hero (reduced height), copy,
 * identity, records, strip. Every prop defaults to the pre-login example dataset, so the entry
 * screen's call site is unchanged; the home screen passes the person's own records instead.
 */
export function AliveEntryLayout({
  children,
  identity = EXAMPLE_IDENTITY,
  recordsTitle = "최근 기록 · 예시",
  recordsHeading,
  rows = exampleRecordRows(),
  recordsZeroMessage,
  recordsAction,
  belowRecords,
  rightExtra,
  rings = EXAMPLE_PHASES.rings,
  phaseLabels = EXAMPLE_PHASES.labels,
  // The last phase that has a ring — never hard-coded, and never the trailing open phase, which
  // has no ring by definition.
  currentPhaseIndex = Math.max(0, EXAMPLE_PHASES.rings.length - 1),
  heroCaption,
}: AliveEntryLayoutProps) {
  return (
    <div className={styles.grid}>
      <div className={styles.left}>
        <div className={styles.copy}>{children}</div>
        <IdentityPanel identity={identity} />
      </div>
      <div className={styles.center}>
        <AliveTrajectory rings={rings} phaseLabels={phaseLabels} caption={heroCaption} />
      </div>
      <div className={styles.right}>
        <RecordsPanel
          title={recordsTitle}
          heading={recordsHeading}
          rows={rows}
          zeroMessage={recordsZeroMessage}
          action={recordsAction}
          below={belowRecords}
        />
        {rightExtra}
      </div>
      <div className={styles.strip}>
        <PhaseStrip labels={phaseLabels} currentIndex={currentPhaseIndex} />
      </div>
    </div>
  );
}

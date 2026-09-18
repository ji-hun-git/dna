import type { ReactNode } from "react";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { PHASE_LABELS } from "@/lib/home/alive-trajectory";
import { EXAMPLE_IDENTITY, exampleRecordRows, nodeValueWithUnit } from "@/lib/home/alive-example-data";
import { AliveTrajectory } from "@/components/home/AliveTrajectory";
import styles from "@/components/home/AliveEntryLayout.module.css";

/** The phase the strip marks as current. A fixed point in time, never a health state. */
const CURRENT_PHASE_INDEX = 2;

function IdentityPanel() {
  const identity = EXAMPLE_IDENTITY;
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
          <dd>{formatKoreanDate(identity.lastResultDate)}</dd>
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

function RecordsPanel() {
  const rows = exampleRecordRows();
  return (
    <div className={styles.panel} aria-labelledby="alive-records-title">
      <p className={styles.panelTitle} id="alive-records-title">
        최근 기록 · 예시
      </p>
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
    </div>
  );
}

function PhaseStrip() {
  return (
    <nav className={styles.phaseStrip} aria-label="검진 시기">
      {PHASE_LABELS.map((label, i) => (
        <div className={styles.phaseStripItem} key={label}>
          <span
            className={[styles.phaseMarker, i === CURRENT_PHASE_INDEX ? styles.phaseMarkerCurrent : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
          <span className={styles.phaseStripLabel}>
            {label}
            {i === CURRENT_PHASE_INDEX ? " · 현재" : ""}
          </span>
        </div>
      ))}
    </nav>
  );
}

export type AliveEntryLayoutProps = {
  children: ReactNode;
};

/**
 * The dense, gridded pre-login entry composition: the copy block and an example identity panel
 * in the left column, the alive-trajectory hero owning the centre, an example records panel on
 * the right, and a phase strip along the bottom. Under ~900px it stacks: hero (reduced height),
 * copy, identity, records, strip.
 */
export function AliveEntryLayout({ children }: AliveEntryLayoutProps) {
  return (
    <div className={styles.grid}>
      <div className={styles.left}>
        <div className={styles.copy}>{children}</div>
        <IdentityPanel />
      </div>
      <div className={styles.center}>
        <AliveTrajectory />
      </div>
      <div className={styles.right}>
        <RecordsPanel />
      </div>
      <div className={styles.strip}>
        <PhaseStrip />
      </div>
    </div>
  );
}

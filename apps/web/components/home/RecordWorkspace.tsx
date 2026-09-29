import type { ReactNode } from "react";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { exampleRecordRows, type ExampleNode } from "@/lib/home/alive-example-data";
import styles from "./RecordWorkspace.module.css";

type Props = {
  children: ReactNode;
  preview?: boolean;
  rows?: ExampleNode[];
  documentCount?: number;
  belowRecords?: ReactNode;
};

/** An actual record ledger, with examples confined to the signed-out preview. */
export function RecordWorkspace({ children, preview = false, rows = [], documentCount = 0, belowRecords }: Props) {
  const visibleRows = preview
    ? [...exampleRecordRows()].sort((a, b) => b.observedOn.localeCompare(a.observedOn)).slice(0, 4)
    : rows;
  const latestDate = visibleRows[0]?.observedOn;
  return (
    <div className={`${styles.workspace} ${preview ? styles.preview : ""}`}>
      <div className={styles.introduction}>{children}</div>
      {!preview && (
        <section className={styles.summary} aria-label="내 기록 요약">
          <div><span>확인한 기록</span><strong>{rows.length}<small>개</small></strong></div>
          <div><span>모아둔 결과지</span><strong>{documentCount}<small>개</small></strong></div>
          <div><span>최근 검사일</span><strong className={styles.date}>{latestDate ? formatKoreanDate(latestDate) : "아직 없음"}</strong></div>
        </section>
      )}
      <div className={styles.body}>
        <section className={styles.ledger} aria-labelledby="record-workspace-title">
          <header className={styles.sectionHeading}>
            <div><p>{preview ? "저장 화면 예시" : "직접 확인한 기록"}</p>
              <h2 id="record-workspace-title">{preview ? "검사 기록" : rows.length ? "최근 검사 기록" : "아직 저장된 기록이 없어요"}</h2>
            </div>
            {preview ? <span className={styles.example}>예시</span> : <a href="/records">전체 기록 보기 <span aria-hidden="true">↗</span></a>}
          </header>
          {visibleRows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">검사일</th><th scope="col">상태</th></tr></thead>
                <tbody>{visibleRows.map((row, index) => (
                  <tr key={`${row.item}-${index}`}>
                    <td>{row.item}</td><td><strong>{row.value}</strong> <span>{row.unit}</span></td>
                    <td>{formatKoreanDate(row.observedOn)}</td><td>직접 확인함</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.document} aria-hidden="true"><span /><span /><span /></div>
              <p>결과지를 추가해 주세요</p>
              <span>결과지에 적힌 값을 확인한 뒤 저장해요.<br />저장한 기록은 여기서 볼 수 있어요.</span>
            </div>
          )}
          {preview && <p className={styles.caption}>화면 설명을 위한 예시이며 실제 사람이나 기관의 기록이 아니에요.</p>}
          {belowRecords}
        </section>
        <aside className={styles.aside}>
          <section className={styles.visit}>
            <span className={styles.visitIcon} aria-hidden="true">↗</span>
            <p>진료 준비</p>
            <h2>진료 때 물어볼 질문</h2>
            <p>저장한 검사값에 대한 질문을<br />확인하고 인쇄할 수 있어요.</p>
            <p><a href="/prepare">질문 목록 보기 <span aria-hidden="true">›</span></a></p>
          </section>
          <div className={styles.privacy}>
            <p>동의 및 삭제</p>
            <p>동의 내역을 확인하거나<br />체험 기록을 삭제할 수 있어요.</p>
            <p><a href="/data-control">데이터 관리 열기 <span aria-hidden="true">›</span></a></p>
          </div>
        </aside>
      </div>
      <footer className={styles.footer}><span>앎 · 건강 기록</span><span>예시 데이터 체험 · 실제 건강정보는 사용하지 않습니다.</span></footer>
    </div>
  );
}

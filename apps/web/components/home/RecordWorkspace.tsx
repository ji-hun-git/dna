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
            <div><p>{preview ? "이렇게 모아볼 수 있어요" : "직접 확인한 기록"}</p>
              <h2 id="record-workspace-title">{preview ? "건강 기록, 한곳에." : rows.length ? "가장 최근에 확인한 값" : "아직 저장된 기록이 없어요"}</h2>
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
              <p>첫 결과지부터 차근차근.</p>
              <span>결과지를 추가하고 적힌 값을 확인하면<br />날짜와 출처가 함께 남아요.</span>
            </div>
          )}
          {preview && <p className={styles.caption}>화면 설명을 위한 예시이며 실제 사람이나 기관의 기록이 아니에요.</p>}
          {belowRecords}
        </section>
        <aside className={styles.aside}>
          <section className={styles.visit}>
            <span className={styles.visitIcon} aria-hidden="true">↗</span>
            <p>다음 진료를 위한 메모</p>
            <h2>궁금했던 것,<br />잊지 않도록.</h2>
            <p>확인한 기록을 바탕으로<br />진료 때 물어볼 내용을 모아요.</p>
            <p><a href="/prepare">진료 때 물어볼 내용 준비 <span aria-hidden="true">›</span></a></p>
          </section>
          <div className={styles.privacy}>
            <p>내 기록은, 내가 관리해요.</p>
            <p>동의한 내용과 보관 상태를 확인하고<br />필요할 때 삭제할 수 있어요.</p>
            <p><a href="/data-control">동의와 삭제 상태 보기 <span aria-hidden="true">›</span></a></p>
          </div>
        </aside>
      </div>
      <footer className={styles.footer}><span>앎 · 나를 알아가는 기록</span><span>예시 데이터 체험 · 실제 건강정보는 사용하지 않습니다.</span></footer>
    </div>
  );
}

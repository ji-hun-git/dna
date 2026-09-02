"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFoundationClient, type FoundationRecord } from "@/lib/foundation/client";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { describeFoundationError } from "@/lib/foundation/messages";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format/korean-date";
import styles from "@/components/records/HealthTimeline.module.css";

function idempotencyKey() {
  return `correction-${crypto.randomUUID()}`;
}

function shortDigest(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

type RecordGroup = {
  key: string;
  observedOn: string;
  documentSha256: string;
  items: FoundationRecord[];
};

// One result sheet produces several records on the same day, so the list is
// grouped by that day and then by the document each value came from.
function groupRecords(records: FoundationRecord[]): RecordGroup[] {
  const groups = new Map<string, RecordGroup>();
  for (const record of records) {
    const key = `${record.observedOn}-${record.documentSha256}`;
    const group = groups.get(key);
    if (group) group.items.push(record);
    else groups.set(key, { key, observedOn: record.observedOn, documentSha256: record.documentSha256, items: [record] });
  }
  return [...groups.values()].sort((left, right) => right.observedOn === left.observedOn
    ? left.documentSha256.localeCompare(right.documentSha256)
    : right.observedOn.localeCompare(left.observedOn));
}

export function IntegratedRecords() {
  const client = useMemo(() => createFoundationClient(), []);
  const [records, setRecords] = useState<FoundationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [draftValue, setDraftValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await client.getSession();
        const loaded = await client.getRecords();
        if (active) setRecords(loaded);
      } catch (error) {
        if (active) setErrorMessage(describeFoundationError(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client]);

  const correctRecord = async (event: FormEvent<HTMLFormElement>, record: FoundationRecord) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const corrected = await client.correctRecord(
        record.recordId,
        draftValue.trim(),
        reason.trim(),
        idempotencyKey(),
      );
      setRecords((current) => current.map((item) => item.recordId === corrected.recordId ? corrected : item));
      setEditingId(undefined);
      setReason("");
      setSuccessMessage(`${corrected.label} 기록을 새 버전으로 저장했어요.`);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegratedShell current="records" status="서버 저장 합성 기록">
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero} aria-labelledby="integrated-records-title">
            <div className={styles.heroCopy}>
              <p>PostgreSQL Health History</p>
              <h1 id="integrated-records-title">새로고침해도 남는<br />확인된 기록</h1>
              <p>각 값의 원래 후보, 현재 버전, 출처 확인값과 수정 이력을 함께 보존합니다.</p>
            </div>
            <aside className={styles.truthPanel} aria-label="서버 기록 상태">
              <header><span>데이터 상태</span><strong>합성 서버 기록</strong></header>
              <p><strong>{String(records.length).padStart(2, "0")}</strong><span>현재 기록</span></p>
              <footer>실제 개인정보·외부기관 데이터 없음</footer>
            </aside>
          </section>

          {loading && <p role="status" aria-live="polite">서버에서 건강 기록을 불러오고 있어요.</p>}
          {successMessage && <p role="status" aria-live="polite">{successMessage}</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage} <a href="/">홈에서 다시 로그인</a></p>}

          {!loading && !errorMessage && records.length === 0 && (
            <p className="gc-integrated-empty">아직 저장된 합성 기록이 없어요. 홈에서 허용된 합성 PDF를 확인해 주세요.</p>
          )}

          {!loading && records.length > 0 && (
            <section className={styles.history} aria-labelledby="durable-history-title">
              <header className={styles.sectionHeading}><div><p>출처와 버전</p><h2 id="durable-history-title">현재 기록 {records.length}개</h2></div><span>서버 응답만 표시해요</span></header>
              {groupRecords(records).map((group) => (
                <section key={group.key} className="gc-records-group" aria-labelledby={`record-group-${group.key}`}>
                  <h3 id={`record-group-${group.key}`}>{formatKoreanDate(group.observedOn)} · 결과지 {shortDigest(group.documentSha256)}</h3>
                  <ol>
                    {group.items.map((record, index) => (
                      <li key={record.recordId} data-testid="durable-record">
                        <div className={styles.historyDate}><span>{String(index + 1).padStart(2, "0")}</span><time dateTime={record.observedOn}>{formatKoreanDate(record.observedOn)}</time></div>
                        <div className={styles.historyValue}><strong>{record.value}</strong><span>{record.unit}</span></div>
                        <div className={styles.historySource}><strong>{record.label}</strong><span>{record.reviewDecision === "CORRECTED" ? "사용자가 값을 수정함" : "사용자가 원문과 같다고 확인함"}</span></div>
                        <details>
                          <summary>출처와 버전 보기</summary>
                          <dl>
                            <div><dt>현재 상태</dt><dd>{record.status}</dd></div>
                            <div><dt>원래 후보</dt><dd>{record.originalValue} {record.unit}</dd></div>
                            <div><dt>현재 버전</dt><dd><code>{record.recordVersionId}</code></dd></div>
                            <div><dt>이전 버전</dt><dd>{record.supersedesVersionId ? <code>{record.supersedesVersionId}</code> : "없음"}</dd></div>
                            <div><dt>문서 확인값</dt><dd><code>{shortDigest(record.documentSha256)}</code></dd></div>
                            <div><dt>후보 근거값</dt><dd><code>{shortDigest(record.sourceTextSha256)}</code></dd></div>
                            <div><dt>확인 시각</dt><dd>{formatKoreanDateTime(record.confirmedAt)}</dd></div>
                            {record.correctionReason && <div><dt>수정 이유</dt><dd>{record.correctionReason}</dd></div>}
                          </dl>
                          {editingId === record.recordId ? (
                            <form className="gc-integrated-correction" onSubmit={(event) => void correctRecord(event, record)}>
                              <label htmlFor={`record-value-${record.recordId}`}>수정할 값</label>
                              <input id={`record-value-${record.recordId}`} value={draftValue} onChange={(event) => setDraftValue(event.target.value)} inputMode="decimal" pattern="[0-9]{1,4}([.][0-9]{1,2})?" required />
                              <label htmlFor={`record-reason-${record.recordId}`}>수정 이유</label>
                              <input id={`record-reason-${record.recordId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} required />
                              <div className="gc-integrated-actions"><button type="button" onClick={() => setEditingId(undefined)}>취소</button><button type="submit" disabled={busy}>{busy ? "서버에 반영 중" : "새 버전으로 저장"}</button></div>
                            </form>
                          ) : (
                            <button type="button" onClick={() => { setEditingId(record.recordId); setDraftValue(record.value); setReason(""); }}>이 기록 수정</button>
                          )}
                        </details>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </section>
          )}

          <section className={styles.boundary} aria-labelledby="integrated-record-boundary"><div><p>현재 제품 경계</p><h2 id="integrated-record-boundary">기록을 보존하지만 진단하지 않아요</h2><span>이 합성 값만으로 정상·비정상, 질환, 치료를 판단하지 않습니다.</span></div><a href="/">홈으로</a></section>
        </div>
      </main>
    </IntegratedShell>
  );
}

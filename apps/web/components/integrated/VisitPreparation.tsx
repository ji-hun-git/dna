"use client";

import { useEffect, useMemo, useState } from "react";
import { createFoundationClient, type FoundationRecord } from "@/lib/foundation/client";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { describeFoundationError } from "@/lib/foundation/messages";
import { formatKoreanDate } from "@/lib/format/korean-date";

/** The questions a person can take to the next visit. They ask, they never answer. */
export const visitQuestions: readonly string[] = [
  "이 값은 어떤 검사에서 나온 건가요?",
  "지난 결과와 비교해 설명해 주실 수 있나요?",
  "다시 확인이 필요하다면 언제가 좋을까요?",
];

const preparationNote = "이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요.";

type VisitPreparationProps = {
  records: FoundationRecord[];
  loading: boolean;
  errorMessage: string;
  onPrint: () => void;
};

function shortDigest(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export function VisitPreparation({ records, loading, errorMessage, onPrint }: VisitPreparationProps) {
  return (
    <main className="gc-prepare">
      <header className="gc-prepare__heading">
        <p>진료 전 준비</p>
        <h1>다음 진료에서 물어볼 것</h1>
        <p className="gc-prepare__note">{preparationNote}</p>
      </header>

      {loading && <p role="status" aria-live="polite">확인한 기록을 불러오고 있어요.</p>}
      {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage} <a href="/">홈에서 다시 로그인</a></p>}

      {!loading && !errorMessage && records.length === 0 && (
        <section className="gc-prepare__empty" aria-labelledby="prepare-empty-title">
          <h2 id="prepare-empty-title">아직 확인한 기록이 없어요</h2>
          <p>결과지를 추가하고 항목을 직접 확인하면 여기에 질문 목록이 만들어져요.</p>
          <a href="/">홈으로</a>
        </section>
      )}

      {records.length > 0 && (
        <>
          <div className="gc-prepare__actions">
            <button type="button" onClick={onPrint}>인쇄하기</button>
            <a href="/records">기록으로 돌아가기</a>
          </div>
          <ol className="gc-prepare__list">
            {records.map((record) => (
              <li key={record.recordVersionId}>
                <article aria-labelledby={`prepare-${record.recordId}`}>
                  <h2 id={`prepare-${record.recordId}`}>{record.label}</h2>
                  <p className="gc-prepare__value"><strong>{record.value}</strong><span>{record.unit}</span></p>
                  <dl>
                    <div><dt>검사일</dt><dd>{formatKoreanDate(record.observedOn)}</dd></div>
                    <div><dt>근거 쪽수</dt><dd>{record.evidencePage}쪽</dd></div>
                    <div><dt>문서 확인값</dt><dd><code>{shortDigest(record.documentSha256)}</code></dd></div>
                    <div><dt>확인 방식</dt><dd>{record.reviewDecision === "CORRECTED" ? "사용자가 값을 수정함" : "사용자가 원문과 같다고 확인함"}</dd></div>
                  </dl>
                  <ul className="gc-prepare__questions">
                    {visitQuestions.map((question) => <li key={question}>{question}</li>)}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}

/** Loads the confirmed server records the visit sheet is printed from. */
export function IntegratedVisitPreparation() {
  const client = useMemo(() => createFoundationClient(), []);
  const [records, setRecords] = useState<FoundationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  return (
    <IntegratedShell current="prepare" status="확인한 기록으로 만든 질문">
      <VisitPreparation
        records={records}
        loading={loading}
        errorMessage={errorMessage}
        onPrint={() => window.print()}
      />
    </IntegratedShell>
  );
}

"use client";

import { useMemo, useState } from "react";
import styles from "./ResearchEvidenceAgent.module.css";
import { competitionTracks, offlineResearchCatalog } from "@/lib/research-data/offline-catalog";
import { runResearchEvidenceAgent } from "@/lib/research-data/evidence-agent";
import type { ResearchAgentQuery } from "@/lib/research-data/contracts";

const topicOptions: Array<{ value: ResearchAgentQuery["topicCode"]; label: string; note: string }> = [
  { value: "life-science-terminology", label: "생명과학 용어", note: "논문 용어와 분류체계" },
  { value: "infectious-disease-events", label: "감염병 사건", note: "뉴스·보고서 사건 태깅" },
  { value: "biomedical-literature", label: "의료·생명 문헌", note: "데이터셋과 언어모델" },
];

const rightsLabels = {
  "metadata-only": "메타데이터만 사용",
  "research-prototype-only": "연구 시제품만",
  "blocked-pending-rights-review": "권리 확인 전 사용 금지",
} as const;

const kindLabels = { dataset: "DATASET", model: "MODEL", catalog: "CATALOG" } as const;

function ExternalIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 13v6H5V6h6" /></svg>;
}

export function ResearchEvidenceAgent() {
  const [topicCode, setTopicCode] = useState<ResearchAgentQuery["topicCode"]>("life-science-terminology");
  const result = useMemo(() => runResearchEvidenceAgent({
    schemaVersion: "research-evidence-query.v1",
    topicCode,
    intent: "discover-resources",
    personalData: false,
    diagnosticUse: false,
  }), [topicCode]);

  return (
    <main className={styles.page}>
      <header className={styles.appbar}>
        <a className={styles.brand} href="/" aria-label="연구근거실 홈으로 이동"><span>앎</span><strong>연구근거실</strong></a>
        <nav aria-label="연구 제품 메뉴"><a href="/" aria-current="page">연구근거</a></nav>
        <span className={styles.snapshot}>SNAPSHOT · 2026-08-12</span>
      </header>

      <section className={styles.hero} aria-labelledby="research-agent-title">
        <div>
          <p className={styles.eyebrow}>RESEARCH EVIDENCE AGENT · PUBLIC METADATA ONLY</p>
          <h1 id="research-agent-title">찾는 것보다<br />쓸 수 있는지가<br />더 중요합니다</h1>
          <p className={styles.heroBody}>DataON과 AIDA의 연구자료를 출처, DOI, 이용 조건, 품질 경고까지 한 번에 확인합니다. 자료를 찾더라도 쓸 근거가 부족하면 멈춥니다.</p>
        </div>
        <aside className={styles.boundary} aria-label="서비스 안전 경계">
          <span>이 화면이 하지 않는 일</span>
          <strong>진단하지 않습니다</strong>
          <ul><li>개인 건강정보 입력 안 함</li><li>치료·질환·의료기관 추천 안 함</li><li>공개 메타데이터 원문처럼 재배포 안 함</li></ul>
          <p><i aria-hidden="true" /> 실시간 외부 API 호출 0건</p>
        </aside>
      </section>

      <section className={styles.metrics} aria-label="연구근거 에이전트 현재 상태">
        <article><span>검토한 공개 자원</span><strong>{String(offlineResearchCatalog.resources.length).padStart(2, "0")}</strong><p>데이터셋·모델·카탈로그</p></article>
        <article><span>원문 다운로드</span><strong>00</strong><p>권리 확인 전 차단</p></article>
        <article><span>개인 건강정보</span><strong>00</strong><p>입력 통로 없음</p></article>
        <article><span>준비 중인 공모전</span><strong>02</strong><p>출품물은 서로 분리</p></article>
      </section>

      <section className={styles.agent} aria-labelledby="agent-console-title">
        <header>
          <div><p className={styles.eyebrow}>01 · TOPIC</p><h2 id="agent-console-title">어떤 연구자료를 찾을까요?</h2></div>
          <span>자유로운 건강질문 대신 안전한 연구 주제만 선택합니다.</span>
        </header>
        <div className={styles.topicGrid} role="group" aria-label="연구 주제">
          {topicOptions.map((option, index) => (
            <button key={option.value} type="button" aria-pressed={topicCode === option.value} onClick={() => setTopicCode(option.value)}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{option.label}</strong><small>{option.note}</small>
            </button>
          ))}
        </div>

        <div className={styles.resultHeader} aria-live="polite">
          <div><p className={styles.eyebrow}>02 · EVIDENCE</p><h2>{result.resources.length}개의 공개 자원을 찾았습니다</h2></div>
          <p>정렬 기준 · 주제 적합성 + 영구 식별자 + 권리 상태</p>
        </div>

        <ol className={styles.results}>
          {result.resources.map(({ resource, score, rightsDecision, reasons }, index) => (
            <li key={resource.id}>
              <div className={styles.resultIndex}><span>{String(index + 1).padStart(2, "0")}</span><strong>{score}</strong><small>FIT</small></div>
              <article>
                <div className={styles.badges}><span>{kindLabels[resource.resourceKind]}</span><em data-state={rightsDecision}>{rightsLabels[rightsDecision]}</em></div>
                <h3>{resource.title}</h3>
                <p>{resource.summary}</p>
                <dl>
                  <div><dt>출처</dt><dd>{resource.sourcePlatform.toUpperCase()}</dd></div>
                  <div><dt>DOI</dt><dd>{resource.doi ?? "없음"}</dd></div>
                  <div><dt>형식</dt><dd>{resource.dataType}</dd></div>
                  <div><dt>확인일</dt><dd>{resource.retrievedAt}</dd></div>
                </dl>
                <details><summary>판단 근거와 주의사항</summary><div><ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><ul>{resource.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></details>
              </article>
              <a href={resource.sourceUrl} target="_blank" rel="noreferrer">공식 출처 <ExternalIcon /></a>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.competitions} aria-labelledby="competition-title">
        <header><p className={styles.eyebrow}>03 · COMPETITION TRACKS</p><h2 id="competition-title">같은 엔진, 다른 두 출품물</h2><span>중복 출품·중복 수상 위험을 피하기 위해 문제 정의와 결과물을 분리합니다.</span></header>
        <div>
          {competitionTracks.map((track, index) => (
            <article key={track.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{track.organizer}</p>
              <h3>{track.title}</h3>
              <time dateTime={track.submissionDeadline}>{track.submissionDeadline.replaceAll("-", ".")}</time>
              <strong>{track.proposedEntry}</strong>
              <footer data-state={track.readiness}>{track.readiness === "building" ? "구현 중" : "참가자격 확인 필요"}<small>{track.hardGate}</small></footer>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.pageFooter}><span>앎 · RESEARCH EVIDENCE LAB</span><p>이 시제품은 공개 메타데이터로만 작동합니다. 실제 데이터 이용은 각 제공기관의 승인과 라이선스 검토 뒤에 진행합니다.</p></footer>
    </main>
  );
}

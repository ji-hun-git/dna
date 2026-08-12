"use client";

import { useMemo, useState } from "react";
import styles from "./PublicProviderExplorer.module.css";
import { publicProviderDemo } from "@/lib/public-data/demo-public-provider";

type ExplorerMode = "providers" | "prices";
type RegionFilter = "전체" | "서울" | "부산";
type ProviderTypeFilter = "전체" | "종합병원" | "병원" | "의원" | "건강검진센터";

const wonFormatter = new Intl.NumberFormat("ko-KR");

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
}

function ExternalIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8" /><path d="M18 13v6H5V6h6" /></svg>;
}

export function PublicProviderExplorer() {
  const [mode, setMode] = useState<ExplorerMode>("providers");
  const [region, setRegion] = useState<RegionFilter>("전체");
  const [providerType, setProviderType] = useState<ProviderTypeFilter>("전체");

  const providerRows = useMemo(() => publicProviderDemo.providers
    .filter((item) => region === "전체" || item.region === region)
    .filter((item) => providerType === "전체" || item.providerType === providerType)
    .toSorted((left, right) => left.providerName.localeCompare(right.providerName, "ko")), [providerType, region]);

  const priceRows = useMemo(() => publicProviderDemo.prices
    .filter((item) => region === "전체" || item.region === region)
    .filter((item) => providerType === "전체" || item.providerType === providerType)
    .toSorted((left, right) => left.providerName.localeCompare(right.providerName, "ko")), [providerType, region]);

  const rowCount = mode === "providers" ? providerRows.length : priceRows.length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.appbar}>
          <a className={styles.brand} href="/" aria-label="앎 건강 홈으로 돌아가기"><span>앎</span><strong>앎</strong></a>
          <nav aria-label="공공 의료정보 메뉴">
            <a href="/providers" aria-current="page">공공정보</a>
            <a href="/connections">연결</a>
            <a href="/data-control">내 데이터</a>
          </nav>
          <span className={styles.appbarState}>SYNTHETIC · NO LIVE API</span>
        </header>

        <section className={styles.hero} aria-labelledby="provider-explorer-title">
          <div className={styles.heroCopy}>
            <p>PUBLIC SOURCE LAB · 01</p>
            <h1 id="provider-explorer-title">비교할수록,<br />출처가 먼저 보여야 해요</h1>
            <p className={styles.heroBody}>병원 이름이나 공개 금액보다 먼저 데이터의 출처, 적용 기준, 한계를 확인하는 중립적 탐색 화면을 만들고 있어요.</p>
          </div>
          <div className={styles.heroProof}>
            <span>연동 상태</span>
            <strong>공공 API 연결 전</strong>
            <p>현재 표시되는 기관·주소·항목·금액은 모두 UI 검증용 합성 데이터예요. 실제 의료기관 조회나 견적이 아닙니다.</p>
            <div><span aria-hidden="true" /> 실시간 요청 0건</div>
          </div>
        </section>

        <section className={styles.stats} aria-label="공공 의료정보 시연 상태">
          <article><span>LIVE API CALLS</span><strong>00</strong><p>실제 외부 요청</p></article>
          <article><span>DEMO PROVIDERS</span><strong>04</strong><p>가상의 의료기관</p></article>
          <article><span>SOURCE CONTRACTS</span><strong>02</strong><p>확인한 공식 카탈로그</p></article>
          <article><span>PERSONAL INPUTS</span><strong>00</strong><p>개인정보 입력란</p></article>
        </section>

        <section className={styles.explorer} aria-labelledby="explorer-title">
          <header className={styles.explorerHeader}>
            <div><p>NEUTRAL EXPLORER</p><h2 id="explorer-title">공공 의료정보 탐색 시연</h2></div>
            <span>추천·순위·예약 기능 없음</span>
          </header>

          <div className={styles.modeSwitch} aria-label="탐색할 정보" role="group">
            <button type="button" aria-pressed={mode === "providers"} onClick={() => setMode("providers")}>
              의료기관 정보 <span>{publicProviderDemo.providers.length}</span>
            </button>
            <button type="button" aria-pressed={mode === "prices"} onClick={() => setMode("prices")}>
              비급여 금액 구조 <span>{publicProviderDemo.prices.length}</span>
            </button>
          </div>

          <div className={styles.filters}>
            <label>지역
              <select value={region} onChange={(event) => setRegion(event.target.value as RegionFilter)}>
                <option>전체</option><option>서울</option><option>부산</option>
              </select>
            </label>
            <label>의료기관 종류
              <select value={providerType} onChange={(event) => setProviderType(event.target.value as ProviderTypeFilter)}>
                <option>전체</option><option>종합병원</option><option>병원</option><option>의원</option><option>건강검진센터</option>
              </select>
            </label>
            <div className={styles.filterBoundary}><strong>개인정보 없는 필터</strong><span>지역·기관 종류만 사용</span></div>
          </div>

          <div className={styles.resultLine} aria-live="polite">
            <p><strong>{String(rowCount).padStart(2, "0")}</strong>개의 합성 결과</p>
            <span>기관명 가나다순 · 광고 없음</span>
          </div>

          <p className={styles.scrollHint}>표를 좌우로 밀어 출처 근거까지 확인하세요.</p>
          <div className={styles.tableFrame}>
            {mode === "providers" ? (
              <table aria-label="합성 의료기관 정보 비교">
                <caption>실제 의료기관이 아닌 합성 레코드를 기관명 가나다순으로 표시합니다.</caption>
                <thead><tr><th scope="col">의료기관</th><th scope="col">종류</th><th scope="col">지역·주소</th><th scope="col">연락처</th><th scope="col">근거</th></tr></thead>
                <tbody>{providerRows.map((item) => (
                  <tr key={item.id}>
                    <th scope="row"><span className={styles.syntheticLabel}>합성</span>{item.providerName}</th>
                    <td>{item.providerType}</td>
                    <td>{item.address}</td>
                    <td>원본 미연결</td>
                    <td><details><summary>필드 근거</summary><p>병원정보 API의 기관명·종별·주소 필드 구조를 참고한 합성 레코드입니다. 실제 원본 행은 조회하지 않았습니다.</p></details></td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              <table aria-label="합성 비급여 금액 구조 비교">
                <caption>금액 비교 UI 검증용 합성 레코드이며 견적이나 청구 예상액이 아닙니다.</caption>
                <thead><tr><th scope="col">항목</th><th scope="col">의료기관</th><th scope="col">합성 공개금액</th><th scope="col">적용 기준</th><th scope="col">근거</th></tr></thead>
                <tbody>{priceRows.map((item) => (
                  <tr key={item.id}>
                    <th scope="row"><span className={styles.syntheticLabel}>합성</span>{item.itemName}<small>{item.itemCode}</small></th>
                    <td>{item.providerName}</td>
                    <td className={styles.amount}>₩{wonFormatter.format(item.currentAmountWon)}<small>예시 금액</small></td>
                    <td>{item.effectivePeriod}</td>
                    <td><details><summary>금액 한계</summary><p>비급여 API의 현재금액·적용기간 필드 구조를 참고했습니다. 실제 가격, 최종 청구액, 의료 질 평가가 아닙니다.</p></details></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {rowCount === 0 && <p className={styles.empty}>선택한 조건의 합성 레코드가 없어요. 필터를 다시 선택해 주세요.</p>}
          </div>
        </section>

        <section className={styles.ledger} aria-labelledby="source-ledger-title">
          <header><span>SOURCE LEDGER · CONTRACTS ONLY</span><strong id="source-ledger-title">실제 연결 전에 확인한 출처</strong></header>
          <div className={styles.ledgerBody}>
            <div className={styles.unitField} role="img" aria-label="두 개의 공식 출처 계약 중 실제 API 연결은 0개입니다">
              {Array.from({ length: 96 }, (_, index) => <span key={index} data-source={index < 2 ? "reviewed" : undefined} aria-hidden="true" />)}
            </div>
            <ol>
              {publicProviderDemo.sources.map((source, index) => (
                <li key={source.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{source.datasetName}</strong><p>{source.agency} · {source.format}</p></div>
                  <em>연동 전</em>
                  <a href={source.catalogUrl} target="_blank" rel="noreferrer">공식 카탈로그 <ExternalIcon /></a>
                </li>
              ))}
            </ol>
          </div>
          <footer><span>API KEY · NOT CONFIGURED</span><span>LIVE DATA · NONE</span><span>PHI · NONE</span></footer>
        </section>

        <section className={styles.nextBoundary} aria-labelledby="connection-boundary-title">
          <div><p>NEXT CONNECTION GATE</p><h2 id="connection-boundary-title">키가 준비돼도 바로 공개하지 않아요</h2><span>응답 스키마·출처·갱신 시각·회수 동작을 검증한 뒤 합성 배지를 제거합니다.</span></div>
          <button type="button" disabled>공식 데이터 연동 후 활성화 <ArrowIcon /></button>
        </section>
      </div>
    </main>
  );
}

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
          <span className={styles.appbarState}>예시 데이터 · 실제 API 연결 전</span>
        </header>

        <section className={styles.hero} aria-labelledby="provider-explorer-title">
          <div className={styles.heroCopy}>
            <p>공공 의료정보</p>
            <h1 id="provider-explorer-title">공개 의료정보를<br />출처와 함께 살펴봐요</h1>
            <p className={styles.heroBody}>데이터 출처와 적용 기준, 주의사항을 먼저 보여드려요.</p>
          </div>
          <div className={styles.heroProof}>
            <span>연동 상태</span>
            <strong>아직 공공 API와 연결되지 않았어요</strong>
            <p>현재 기관·주소·항목·금액은 모두 화면 확인용 예시예요. 실제 의료기관 조회 결과나 예상 비용이 아닙니다.</p>
            <div><span aria-hidden="true" /> 실시간 요청 0건</div>
          </div>
        </section>

        <section className={styles.stats} aria-label="공공 의료정보 시연 상태">
          <article><span>실제 API 요청</span><strong>00</strong><p>외부 데이터 요청</p></article>
          <article><span>예시 의료기관</span><strong>04</strong><p>화면 확인용 기관</p></article>
          <article><span>공공데이터 출처</span><strong>02</strong><p>확인한 공식 카탈로그</p></article>
          <article><span>개인정보 입력</span><strong>00</strong><p>받지 않아요</p></article>
        </section>

        <section className={styles.explorer} aria-labelledby="explorer-title">
          <header className={styles.explorerHeader}>
            <div><p>의료정보 살펴보기</p><h2 id="explorer-title">공공 의료정보 예시</h2></div>
            <span>추천, 순위, 예약 기능은 없어요</span>
          </header>

          <div className={styles.modeSwitch} aria-label="탐색할 정보" role="group">
            <button type="button" aria-pressed={mode === "providers"} onClick={() => setMode("providers")}>
              의료기관 <span>{publicProviderDemo.providers.length}</span>
            </button>
            <button type="button" aria-pressed={mode === "prices"} onClick={() => setMode("prices")}>
              비급여 항목·금액 <span>{publicProviderDemo.prices.length}</span>
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
            <div className={styles.filterBoundary}><strong>개인정보를 입력하지 않아요</strong><span>지역과 기관 종류만 선택해요</span></div>
          </div>

          <div className={styles.resultLine} aria-live="polite">
            <p><strong>{String(rowCount).padStart(2, "0")}</strong>개의 예시 결과</p>
            <span>기관명 가나다순 · 광고 없음</span>
          </div>

          <p className={styles.scrollHint}>표를 좌우로 스크롤해 데이터 설명까지 확인하세요.</p>
          <div className={styles.tableFrame}>
            {mode === "providers" ? (
              <table aria-label="예시 의료기관 정보 비교">
                <caption>실제 의료기관이 아닌 예시 정보를 기관명 가나다순으로 표시합니다.</caption>
                <thead><tr><th scope="col">의료기관</th><th scope="col">종류</th><th scope="col">지역·주소</th><th scope="col">연락처</th><th scope="col">근거</th></tr></thead>
                <tbody>{providerRows.map((item) => (
                  <tr key={item.id}>
                    <th scope="row"><span className={styles.syntheticLabel}>예시</span>{item.providerName}</th>
                    <td>{item.providerType}</td>
                    <td>{item.address}</td>
                    <td>제공하지 않음</td>
                    <td><details><summary>데이터 설명</summary><p>병원정보 API의 기관명, 종류, 주소 형식을 참고해 만든 예시예요. 실제 데이터는 조회하지 않았습니다.</p></details></td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              <table aria-label="예시 비급여 금액 비교">
                <caption>화면 확인용 예시 금액이며 견적이나 예상 청구액이 아닙니다.</caption>
                <thead><tr><th scope="col">항목</th><th scope="col">의료기관</th><th scope="col">예시 금액</th><th scope="col">적용 기준</th><th scope="col">근거</th></tr></thead>
                <tbody>{priceRows.map((item) => (
                  <tr key={item.id}>
                    <th scope="row"><span className={styles.syntheticLabel}>예시</span>{item.itemName}<small>{item.itemCode}</small></th>
                    <td>{item.providerName}</td>
                    <td className={styles.amount}>₩{wonFormatter.format(item.currentAmountWon)}<small>예시 금액</small></td>
                    <td>{item.effectivePeriod}</td>
                    <td><details><summary>금액 안내</summary><p>비급여 API의 금액과 적용 기간 형식을 참고했어요. 실제 가격이나 최종 청구액, 의료의 질을 뜻하지 않습니다.</p></details></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {rowCount === 0 && <p className={styles.empty}>선택한 조건에 맞는 예시가 없어요. 다른 조건을 선택해 주세요.</p>}
          </div>
        </section>

        <section className={styles.ledger} aria-labelledby="source-ledger-title">
          <header><span>확인한 공식 출처</span><strong id="source-ledger-title">실제 연결 전에 살펴본 공공데이터</strong></header>
          <div className={styles.ledgerBody}>
            <div className={styles.unitField} role="img" aria-label="두 개의 공식 출처 계약 중 실제 API 연결은 0개입니다">
              {Array.from({ length: 96 }, (_, index) => <span key={index} data-source={index < 2 ? "reviewed" : undefined} aria-hidden="true" />)}
            </div>
            <ol>
              {publicProviderDemo.sources.map((source, index) => (
                <li key={source.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{source.datasetName}</strong><p>{source.agency} · {source.format}</p></div>
                  <em>아직 연결되지 않음</em>
                  <a href={source.catalogUrl} target="_blank" rel="noreferrer">공식 출처 열기 <ExternalIcon /></a>
                </li>
              ))}
            </ol>
          </div>
          <footer><span>API 연결 전</span><span>실제 데이터 없음</span><span>개인 건강정보 없음</span></footer>
        </section>

        <section className={styles.nextBoundary} aria-labelledby="connection-boundary-title">
          <div><p>공식 연결 전 확인</p><h2 id="connection-boundary-title">공식 데이터는 확인한 뒤 보여드려요</h2><span>데이터 형식과 출처, 갱신 시각, 오류 상황을 확인한 뒤 예시 표시를 제거해요.</span></div>
          <button type="button" disabled>공식 연동 준비 중 <ArrowIcon /></button>
        </section>
      </div>
    </main>
  );
}

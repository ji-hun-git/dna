"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createFoundationClient, type HealthEvent } from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { searchEvents } from "@/lib/my-data/search-events";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { LivingCellCanvas } from "@/components/my-data/LivingCellCanvas";
import { EvidenceDrawer } from "@/components/my-data/EvidenceDrawer";
import { HealthEventTable } from "@/components/my-data/HealthEventTable";
import styles from "@/components/my-data/MyData.module.css";

function needsSignIn(error: unknown) {
  const state = foundationShellState(error);
  return state === "UNAUTHENTICATED" || state === "SESSION_EXPIRED";
}

const NO_NEW_IDS = new Set<string>();

export function MyData() {
  const client = useMemo(() => createFoundationClient(), []);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorAction, setErrorAction] = useState<"retry-read" | "sign-in">();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [newIds, setNewIds] = useState<Set<string>>(NO_NEW_IDS);
  // Ids seen in the previous successful load; null until the first load so nothing animates on arrival at the page.
  const seenIdsRef = useRef<Set<string> | null>(null);
  const invokerRef = useRef<HTMLElement | SVGElement | null>(null);
  const toggleSelected = (eventId: string, invoker?: HTMLElement | SVGElement) => {
    setSelectedId((current) => {
      if (current === eventId) {
        invokerRef.current?.focus();
        return undefined;
      }
      invokerRef.current = invoker ?? null;
      return eventId;
    });
  };
  const closeDrawer = () => {
    setSelectedId(undefined);
    invokerRef.current?.focus();
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage("");
    setErrorAction(undefined);
    void (async () => {
      try {
        await client.getSession();
        const loaded = await client.getHealthEvents();
        if (active) {
          const ids = new Set(loaded.map((event) => event.eventId));
          const seen = seenIdsRef.current;
          setNewIds(seen ? new Set([...ids].filter((id) => !seen.has(id))) : NO_NEW_IDS);
          seenIdsRef.current = ids;
          setEvents(loaded);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(describeFoundationError(error));
          setErrorAction(needsSignIn(error) ? "sign-in" : "retry-read");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client, loadAttempt]);

  // Arriving from 측정 이력 "출처 보기": open that event's evidence drawer.
  useEffect(() => {
    if (events.length === 0 || typeof window === "undefined") return;
    const match = /^#event-([0-9a-f-]{36})$/.exec(window.location.hash);
    if (match && events.some((event) => event.eventId === match[1])) setSelectedId(match[1]);
  }, [events]);

  const search = useMemo(() => searchEvents(events, query), [events, query]);
  const selected = selectedId ? events.find((event) => event.eventId === selectedId) : undefined;
  const trimmed = query.trim();
  const searchStatus = !trimmed ? "" : search.count === 0 ? `${trimmed} 기록이 없어요.` : `${trimmed} 기록 ${search.count}개`;

  return (
    <IntegratedShell current="my-data" status="예시 데이터">
      <main className={`${styles.page} gc-product-page`}>
        <div className={`${styles.shell} gc-page-content`}>
          <section className={`${styles.hero} gc-page-heading`} aria-labelledby="my-data-title">
            <p>직접 확인한 기록을 시간 순서로</p>
            <h1 id="my-data-title">나의 데이터</h1>
            <p>칸을 선택하면 검사값과 결과지 출처를 볼 수 있어요. 검사값에 대한 해석은 제공하지 않아요.</p>
          </section>

          {loading && <p role="status" aria-live="polite">기록을 불러오고 있어요.</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}{" "}
            {errorAction === "sign-in" && <a href="/">홈에서 다시 로그인</a>}
            {errorAction === "retry-read" && <button type="button" disabled={loading} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>다시 불러오기</button>}
          </p>}

          {!loading && !errorMessage && events.length === 0 && (
            <section className="gc-product-empty">
              <p>아직 확인한 기록이 없어요. 홈에서 결과지를 추가하고 직접 확인해 주세요.</p>
              <a className="gc-button gc-button--primary" href="/">결과지 추가하러 가기</a>
            </section>
          )}

          {events.length > 0 && (
            <>
              <LivingCellCanvas
                events={events}
                selectedId={selectedId}
                matchedIds={search.matchedIds}
                newIds={newIds}
                onSelect={toggleSelected}
              />

              <form className={styles.search} role="search" onSubmit={(submit) => submit.preventDefault()}>
                <label htmlFor="my-data-search">검사 항목 검색</label>
                <input id="my-data-search" type="search" value={query} onChange={(change) => setQuery(change.target.value)}
                  placeholder="예: 총콜레스테롤" autoComplete="off" />
                <p role="status" aria-label="검색 결과" aria-live="polite">{searchStatus}</p>
              </form>

              {selected && (
                <EvidenceDrawer event={selected} onClose={closeDrawer} returnFocusTo={invokerRef.current} />
              )}

              <HealthEventTable events={events} selectedId={selectedId} matchedIds={search.matchedIds} onSelect={toggleSelected} />
            </>
          )}

          <nav className={styles.secondary} aria-label="나의 데이터 더 보기">
            <a href="/records">기록 목록과 날짜별 비교</a>
            <a href="/prepare">진료 준비 질문</a>
          </nav>
        </div>
      </main>
    </IntegratedShell>
  );
}

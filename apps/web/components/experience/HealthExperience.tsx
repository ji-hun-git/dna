"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { HealthHomeConcept } from "@/components/concept/HealthHomeConcept";
import {
  RecordImportCandidate,
  RecordImportConcept,
  RecordImportStage,
} from "@/components/concept/RecordImportConcept";

type ReviewCandidate = RecordImportCandidate & {
  id: string;
  sourceName: string;
  observedAt: string;
};

const candidates: readonly ReviewCandidate[] = [
  {
    id: "hba1c",
    label: "당화혈색소",
    value: "6.1",
    unit: "%",
    reference: "4.0–5.6 %",
    sourceName: "삼성 건강검진 결과지",
    observedAt: "2026-07-28",
  },
  {
    id: "cholesterol",
    label: "총콜레스테롤",
    value: "188",
    unit: "mg/dL",
    reference: "120–199 mg/dL",
    sourceName: "삼성 건강검진 결과지",
    observedAt: "2026-07-28",
  },
  {
    id: "vitamin-d",
    label: "비타민 D",
    value: "31",
    unit: "ng/mL",
    reference: "30–100 ng/mL",
    sourceName: "삼성 건강검진 결과지",
    observedAt: "2026-07-28",
  },
] as const;

const homeRecordMetadata = [
  { id: "record-1", label: "당화혈색소", value: "6.1%", source: "삼성 건강검진 결과지", observedAt: "2026-07-28" },
  { id: "record-2", label: "총콜레스테롤", value: "188 mg/dL", source: "삼성 건강검진 결과지", observedAt: "2026-07-28" },
  { id: "record-3", label: "비타민 D", value: "31 ng/mL", source: "강남세브란스병원 검사 결과", observedAt: "2026-04-12" },
] as const;

export function HealthExperience() {
  const [view, setView] = useState<"home" | RecordImportStage>("home");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candidateValues, setCandidateValues] = useState(() => candidates.map((candidate) => candidate.value));
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [editError, setEditError] = useState("");

  const candidate = useMemo(() => {
    const current = candidates[Math.min(candidateIndex, candidates.length - 1)];
    return { ...current, value: candidateValues[Math.min(candidateIndex, candidateValues.length - 1)] };
  }, [candidateIndex, candidateValues]);

  const recentRecords = useMemo(() => homeRecordMetadata.map((record, index) => {
    const reviewed = candidates[index];
    if (!reviewed) return record;
    const spacer = reviewed.unit === "%" ? "" : " ";
    return { ...record, value: `${candidateValues[index]}${spacer}${reviewed.unit}` };
  }), [candidateValues]);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [view]);

  const restartReview = () => {
    setCandidateIndex(0);
    setConfirmedCount(0);
    setExcludedCount(0);
    setEditing(false);
    setEditError("");
  };

  const resetReview = () => {
    restartReview();
    setCandidateValues(candidates.map((item) => item.value));
  };

  const beginImport = () => {
    resetReview();
    setView("source");
  };

  const closeImport = () => {
    setView("home");
    setEditing(false);
  };

  const advance = (decision: "confirmed" | "excluded") => {
    if (decision === "confirmed") setConfirmedCount((count) => count + 1);
    else setExcludedCount((count) => count + 1);

    if (candidateIndex >= candidates.length - 1) setView("complete");
    else setCandidateIndex((index) => index + 1);
  };

  const openEditor = () => {
    setDraftValue(candidate.value);
    setEditError("");
    setEditing(true);
  };

  const saveCorrection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = draftValue.trim();
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
      setEditError("숫자만 입력해 주세요.");
      return;
    }
    setCandidateValues((values) => values.map((value, index) => index === candidateIndex ? normalized : value));
    setEditing(false);
    advance("confirmed");
  };

  const saveRecords = () => {
    setSavedCount(confirmedCount);
    setView("home");
  };

  const goBack = () => {
    if (view === "source") setView("home");
    else if (view === "review") setView("source");
    else {
      restartReview();
      setView("review");
    }
  };

  if (view === "home") {
    return (
      <HealthHomeConcept
        userName="지훈"
        updatedAt="2026-08-10"
        sourceCount={4}
        recordCount={17 + savedCount}
        pendingReviewCount={savedCount > 0 ? 0 : candidates.length}
        savedRecordCount={savedCount}
        metric={{
          name: "당화혈색소",
          value: candidateValues[0],
          unit: "%",
          observedAt: "2026-07-28",
          delta: "이전 기록보다 0.2%p 낮아요",
          source: "삼성 건강검진 결과지",
          status: "verified",
        }}
        recentRecords={recentRecords}
        onStartImport={beginImport}
      />
    );
  }

  return (
    <>
      <RecordImportConcept
        stage={view}
        sourceName={candidate.sourceName}
        observedAt={candidate.observedAt}
        currentItem={candidateIndex + 1}
        totalItems={candidates.length}
        candidate={candidate}
        confirmedCount={confirmedCount}
        excludedCount={excludedCount}
        onBack={goBack}
        onClose={closeImport}
        onChooseSource={() => setView("review")}
        onConfirm={() => advance("confirmed")}
        onEdit={openEditor}
        onExclude={() => advance("excluded")}
        onSave={saveRecords}
        onReviewAgain={() => { restartReview(); setView("review"); }}
      />

      <Dialog.Root open={editing} onOpenChange={setEditing}>
        <Dialog.Portal>
          <Dialog.Overlay className="gc-edit-dialog__overlay" />
          <Dialog.Content className="gc-edit-dialog__content" aria-describedby="edit-value-description">
            <Dialog.Title>수치를 수정할까요?</Dialog.Title>
            <Dialog.Description id="edit-value-description">
              원본 결과지와 같은 값을 입력해 주세요. 단위는 {candidate.unit}예요.
            </Dialog.Description>
            <form onSubmit={saveCorrection}>
              <label htmlFor="candidate-value">{candidate.label} 값</label>
              <div className="gc-edit-dialog__field">
                <input
                  id="candidate-value"
                  inputMode="decimal"
                  value={draftValue}
                  onChange={(event) => { setDraftValue(event.target.value); setEditError(""); }}
                  aria-invalid={editError ? "true" : "false"}
                  aria-describedby={editError ? "candidate-value-error" : undefined}
                  autoFocus
                />
                <span>{candidate.unit}</span>
              </div>
              {editError && <p id="candidate-value-error" role="alert">{editError}</p>}
              <div className="gc-edit-dialog__actions">
                <Dialog.Close asChild><button type="button">취소</button></Dialog.Close>
                <button type="submit">수정값 저장</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

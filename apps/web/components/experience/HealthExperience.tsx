"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { HealthHomeConcept } from "@/components/concept/HealthHomeConcept";
import {
  RecordImportCandidate,
  RecordImportConcept,
  RecordImportStage,
} from "@/components/concept/RecordImportConcept";
import {
  inspectLocalDocument,
  LocalDocumentError,
  type LocalDocumentReceipt,
} from "@/lib/imports/local-document";
import { EvidenceLens } from "@/components/records/EvidenceLens";
import { candidateOnlyPipelineDisclosure } from "@/lib/medical-ai/policy";

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
    sourceName: "예시 건강검진 결과지",
    observedAt: "2026-07-28",
  },
  {
    id: "cholesterol",
    label: "총콜레스테롤",
    value: "188",
    unit: "mg/dL",
    reference: "120–199 mg/dL",
    sourceName: "예시 건강검진 결과지",
    observedAt: "2026-07-28",
  },
  {
    id: "vitamin-d",
    label: "비타민 D",
    value: "31",
    unit: "ng/mL",
    reference: "30–100 ng/mL",
    sourceName: "예시 건강검진 결과지",
    observedAt: "2026-07-28",
  },
] as const;

const homeRecordMetadata = [
  { id: "record-1", label: "당화혈색소", value: "6.1%", source: "예시 건강검진 결과지", observedAt: "2026-07-28" },
  { id: "record-2", label: "총콜레스테롤", value: "188 mg/dL", source: "예시 건강검진 결과지", observedAt: "2026-07-28" },
  { id: "record-3", label: "비타민 D", value: "31 ng/mL", source: "예시 대학병원 검사 결과", observedAt: "2026-04-12" },
] as const;

export function HealthExperience() {
  const [view, setView] = useState<"home" | "evidence" | RecordImportStage>("home");
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candidateValues, setCandidateValues] = useState(() => candidates.map((candidate) => candidate.value));
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [editError, setEditError] = useState("");
  const [documentReceipt, setDocumentReceipt] = useState<LocalDocumentReceipt>();
  const [sourceMessage, setSourceMessage] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);

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
    setDocumentReceipt(undefined);
    setSourceMessage("");
    setSourceError("");
    setView("source");
  };

  const closeImport = () => {
    setView("home");
    setEditing(false);
    setSourceMessage("");
    setSourceError("");
  };

  const chooseSource = (source: "device" | "camera" | "provider") => {
    setSourceError("");
    if (source === "device") {
      setSourceMessage("");
      return;
    }
    setSourceMessage(
      source === "camera"
        ? "촬영 기능은 아직 준비 중이에요. 지금은 PDF, PNG, JPEG 파일을 선택해 주세요."
        : "기관 연결은 아직 사용할 수 없어요. 지금은 기기에 있는 파일로 체험할 수 있어요.",
    );
  };

  const selectLocalDocument = async (file: File) => {
    setSourceError("");
    setSourceMessage("");
    setIsInspecting(true);
    try {
      const receipt = await inspectLocalDocument(file);
      setDocumentReceipt(receipt);
      setView("processing");
    } catch (error) {
      setDocumentReceipt(undefined);
      setSourceError(
        error instanceof LocalDocumentError
          ? error.message
          : "파일을 읽지 못했어요. 다른 파일을 선택해 주세요.",
      );
    } finally {
      setIsInspecting(false);
    }
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
      setEditError("숫자로 입력해 주세요. 예: 6.1");
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
    else if (view === "processing") setView("source");
    else if (view === "review") setView(documentReceipt ? "processing" : "source");
    else {
      restartReview();
      setView("review");
    }
  };

  if (view === "home") {
    return (
      <HealthHomeConcept
        userName="사용자"
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
          source: "예시 건강검진 결과지",
          status: "verified",
        }}
        recentRecords={recentRecords}
        onStartImport={beginImport}
        onResumeReview={() => {
          resetReview();
          setView("review");
        }}
        onOpenRecord={(recordId) => {
          const index = homeRecordMetadata.findIndex((record) => record.id === recordId);
          setSelectedRecordIndex(index >= 0 ? index : 0);
          setView("evidence");
        }}
      />
    );
  }

  if (view === "evidence") {
    const record = candidates[selectedRecordIndex] ?? candidates[0];
    return (
      <EvidenceLens
        record={{
          id: record.id,
          label: record.label,
          value: candidateValues[selectedRecordIndex] ?? record.value,
          originalValue: record.value,
          unit: record.unit,
          reference: record.reference,
          sourceName: record.sourceName,
          observedAt: record.observedAt,
          sourceLocation: "2쪽 · 검사결과 표 · 4행",
          sourceDigest: "sha256:7c91…42a8 · 예시 문서",
          extractedAt: "2026-08-10 09:41",
          confirmedAt: "2026-08-10 09:44",
          automation: candidateOnlyPipelineDisclosure,
        }}
        onBack={() => setView("home")}
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
        documentReceipt={documentReceipt}
        sourceMessage={sourceMessage}
        sourceError={sourceError}
        isInspecting={isInspecting}
        onBack={goBack}
        onClose={closeImport}
        onChooseSource={chooseSource}
        onFileSelect={selectLocalDocument}
        onBeginReview={() => setView("review")}
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
            <Dialog.Title>값 수정</Dialog.Title>
            <Dialog.Description id="edit-value-description">
              결과지와 같은 값을 입력해 주세요. 단위는 {candidate.unit}입니다.
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
                <button type="submit">수정한 값 저장</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

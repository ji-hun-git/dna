"use client";

import { useState } from "react";

/** No raw-document embedding. The server authorizes and serves a PNG derivative only. */
export function SourcePreview({ documentId, page = 1 }: { documentId: string; page?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p role="status">원문 미리보기를 불러오지 못했어요. 기록은 바뀌지 않았어요. <button type="button" onClick={() => setFailed(false)}>다시 불러오기</button></p>;
  return <figure className="gc-source-preview">
    <img src={`/api/foundation/documents/${encodeURIComponent(documentId)}/preview`}
      alt={`예시 결과지 ${page}쪽 미리보기`} loading="lazy" onError={() => setFailed(true)} />
    <figcaption>예시 데이터 · 업로드한 결과지의 첫 페이지를 이미지로 보여드려요. 항목은 미리 정한 예시이며 문자 인식 결과가 아니에요.</figcaption>
  </figure>;
}

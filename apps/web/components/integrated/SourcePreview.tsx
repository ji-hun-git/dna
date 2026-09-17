"use client";

import { useState } from "react";

/**
 * No raw-document embedding. The server authorizes and serves one PNG derivative — the first page.
 * `page` is the page the value was read from; when it is not the first page the caption says so
 * instead of pretending the image is that page.
 */
export function SourcePreview({ documentId, page = 1 }: { documentId: string; page?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p role="status">원문 미리보기를 불러오지 못했어요. 기록은 바뀌지 않았어요. <button type="button" onClick={() => setFailed(false)}>다시 불러오기</button></p>;
  const firstPage = page === 1;
  return <figure className="gc-source-preview" data-page={page}>
    <img src={`/api/foundation/documents/${encodeURIComponent(documentId)}/preview`}
      alt={firstPage ? "예시 결과지 1쪽 미리보기" : `예시 결과지 첫 페이지 미리보기 (값은 ${page}쪽)`} loading="lazy" onError={() => setFailed(true)} />
    <figcaption>
      {firstPage
        ? "예시 데이터 · 업로드한 결과지의 첫 페이지를 이미지로 보여드려요. "
        : `예시 데이터 · 값은 ${page}쪽에 있어요. 미리보기는 결과지의 첫 페이지만 보여드려요. `}
      항목은 결과지의 글자 정보에서 읽은 값이며, 이미지를 판독한 결과가 아니에요.
    </figcaption>
  </figure>;
}

import { FoundationClientError, type FoundationErrorCode } from "@/lib/foundation/client";

const koreanMessage: Record<FoundationErrorCode, string> = {
  authentication_required: "로그인이 필요해요. 다시 로그인해 주세요.",
  session_expired: "로그인 시간이 끝났어요. 다시 로그인해 주세요.",
  forbidden: "이 작업을 수행할 권한을 확인하지 못했어요.",
  consent_required: "결과지 처리 동의가 필요해요.",
  consent_revoked: "결과지 처리 동의를 철회한 상태예요. 다시 동의한 뒤 진행해 주세요.",
  resource_not_found: "요청한 기록을 찾지 못했어요.",
  conflict: "이미 처리됐거나 다른 화면에서 상태가 바뀌었어요. 새로고침한 뒤 확인해 주세요.",
  invalid_state_transition: "현재 처리 단계에서는 이 작업을 진행할 수 없어요.",
  validation_error: "입력한 내용을 다시 확인해 주세요.",
  upload_rejected: "허용된 합성 PDF가 아니어서 파일을 받지 않았어요.",
  processing_failed: "파일 처리에 실패했어요. 원본은 기록으로 저장되지 않았습니다.",
  retryable_dependency_failure: "처리 서비스가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요.",
  rate_limited: "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  internal_error: "서버가 요청을 완료하지 못했어요. 같은 작업을 반복하지 말고 다시 확인해 주세요.",
  invalid_server_response: "서버 응답 형식을 확인할 수 없어 화면에 반영하지 않았어요.",
  csrf_unavailable: "보안 확인값이 없어 작업을 중단했어요. 다시 로그인해 주세요.",
};

export function describeFoundationError(error: unknown) {
  return error instanceof FoundationClientError
    ? koreanMessage[error.code]
    : "요청을 완료하지 못했어요. 네트워크 연결을 확인해 주세요.";
}

export function foundationShellState(error: unknown) {
  if (!(error instanceof FoundationClientError)) return "AUTHORIZATION_DENIED" as const;
  if (error.code === "authentication_required") return "UNAUTHENTICATED" as const;
  if (error.code === "session_expired" || error.code === "csrf_unavailable") return "SESSION_EXPIRED" as const;
  return "AUTHORIZATION_DENIED" as const;
}

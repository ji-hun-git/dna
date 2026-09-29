import { FoundationClientError, type FoundationErrorCode } from "@/lib/foundation/client";

const koreanMessage: Record<FoundationErrorCode, string> = {
  authentication_required: "로그인이 필요해요. 다시 로그인해 주세요.",
  session_expired: "로그인 시간이 끝났어요. 다시 로그인해 주세요.",
  forbidden: "이 작업을 할 수 있는 권한이 없어요. 로그인한 계정을 확인해 주세요.",
  consent_required: "결과지 처리 동의가 필요해요.",
  consent_revoked: "결과지 처리 동의를 철회한 상태예요. 다시 동의한 뒤 진행해 주세요.",
  resource_not_found: "요청한 기록을 찾지 못했어요.",
  conflict: "이미 처리됐거나 다른 화면에서 상태가 바뀌었어요. 새로고침한 뒤 확인해 주세요.",
  invalid_state_transition: "현재 처리 단계에서는 이 작업을 진행할 수 없어요.",
  validation_error: "입력한 내용을 다시 확인해 주세요.",
  upload_rejected: "등록된 예시 PDF가 아니어서 전송하지 않았어요. 제공된 예시 결과지를 선택해 주세요.",
  processing_failed: "파일을 처리하지 못했어요. 기록 목록에서 저장 여부를 확인해 주세요.",
  retryable_dependency_failure: "처리 서비스가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요.",
  rate_limited: "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
  internal_error: "요청을 완료하지 못했어요. 같은 작업을 반복하기 전에 처리 상태를 확인해 주세요.",
  invalid_server_response: "받은 정보를 확인할 수 없어 표시하지 않았어요. 다시 불러와 주세요.",
  csrf_unavailable: "로그인 정보를 확인할 수 없어 작업을 중단했어요. 다시 로그인해 주세요.",
  network_unavailable: "서버에 연결하지 못했어요. 연결을 확인한 뒤 상태를 다시 불러와 주세요.",
  request_timeout: "서버 응답이 늦어져 요청을 멈췄어요. 잠시 후 다시 시도해 주세요.",
};

export function describeFoundationError(error: unknown) {
  if (error instanceof FoundationClientError) {
    if (error.problemCode === "demo_bootstrap_disabled") return "현재 체험을 시작할 수 없어요.";
    if (error.problemCode === "demo_capacity_exhausted") return "체험 이용 한도에 도달했어요. 운영자에게 문의해 주세요.";
  }
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

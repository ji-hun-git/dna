import { expect, it } from "vitest";
import { FoundationClientError } from "@/lib/foundation/client";
import { describeFoundationError, describeRefusedBootstrap } from "@/lib/foundation/messages";

it("distinguishes a closed or full demo from a temporary request rate limit", () => {
  expect(describeFoundationError(new FoundationClientError("forbidden", 403, "demo_bootstrap_disabled")))
    .toBe("이 환경에서는 체험 시작이 열려 있지 않아요.");
  expect(describeFoundationError(new FoundationClientError("forbidden", 403, "demo_capacity_exhausted")))
    .toBe("체험 공간이 가득 찼어요. 운영자가 확인한 뒤 다시 시작할 수 있어요.");
  expect(describeFoundationError(new FoundationClientError("rate_limited", 429, "rate_limited")))
    .toBe("요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.");
});

it("gives every refused bootstrap its own sentence and its own next action", () => {
  const refusals = [
    new FoundationClientError("rate_limited", 429, "rate_limited"),
    new FoundationClientError("forbidden", 403, "demo_capacity_exhausted"),
    new FoundationClientError("forbidden", 403, "demo_bootstrap_disabled"),
    new FoundationClientError("forbidden", 403, "origin_denied"),
  ].map((error) => describeRefusedBootstrap(error));

  expect(refusals).toEqual([
    { message: "체험 시작 요청이 너무 많아요.", nextAction: "1분쯤 뒤에 체험 시작을 다시 눌러 주세요." },
    { message: "체험 공간이 가득 찼어요. 운영자가 확인한 뒤 다시 시작할 수 있어요.", nextAction: "기다려도 자리가 생기지 않아요. 운영자에게 알려 주세요." },
    { message: "이 환경에서는 체험 시작이 열려 있지 않아요.", nextAction: "이 환경의 운영자에게 체험 시작을 열어 달라고 요청해 주세요." },
    { message: "이 주소에서는 체험을 시작할 수 없어요.", nextAction: "안내받은 주소로 다시 열어 주세요." },
  ]);
  expect(new Set(refusals.map((refusal) => refusal?.message)).size).toBe(4);
});

it("does not call a failure a refusal unless the server refused the bootstrap itself", () => {
  expect(describeRefusedBootstrap(new FoundationClientError("forbidden", 403, "something_new")))
    .toEqual({ message: "체험 시작이 거절됐어요.", nextAction: "페이지를 새로 고친 뒤 다시 시도해 주세요." });
  expect(describeRefusedBootstrap(new FoundationClientError("retryable_dependency_failure", 503, "retryable_dependency_failure"))).toBeUndefined();
  expect(describeRefusedBootstrap(new FoundationClientError("internal_error", 500))).toBeUndefined();
  expect(describeRefusedBootstrap(new FoundationClientError("network_unavailable", 0))).toBeUndefined();
  expect(describeRefusedBootstrap(new Error("boom"))).toBeUndefined();
});

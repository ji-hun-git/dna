import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import {
  inspectLocalDocument,
  LocalDocumentError,
  MAX_LOCAL_DOCUMENT_BYTES,
  validateLocalDocument,
} from "@/lib/imports/local-document";

it("validates and fingerprints an allowed document without retaining its name", async () => {
  const body = "%PDF-1.7\nsynthetic health result";
  const receipt = await inspectLocalDocument(
    new File([body], "person-name-must-not-survive.pdf", { type: "application/pdf" }),
  );

  expect(receipt).toEqual({
    format: "PDF",
    byteLength: body.length,
    sizeLabel: "1 KB",
    sha256: `sha256:${createHash("sha256").update(body).digest("hex")}`,
    processingBoundary: "local-synthetic-fixture",
  });
  expect(JSON.stringify(receipt)).not.toContain("person-name");
});

it.each([
  [new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])], "result.png", { type: "image/png" }), "PNG"],
  [new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])], "result.jpeg", { type: "image/jpeg" }), "JPEG"],
] as const)("accepts a file only when its bytes match its declared image format", async (file, format) => {
  expect((await inspectLocalDocument(file)).format).toBe(format);
});

it("rejects renamed content before creating a receipt", async () => {
  await expect(inspectLocalDocument(
    new File(["plain text renamed as pdf"], "renamed.pdf", { type: "application/pdf" }),
  )).rejects.toMatchObject({
    name: "LocalDocumentError",
    code: "content_mismatch",
    message: "파일 내용이 확장자와 맞지 않아요. 원본 PDF, PNG, JPEG 파일을 선택해 주세요.",
  });
});

it.each([
  [new File([], "empty.pdf", { type: "application/pdf" }), "empty"],
  [new File([new Uint8Array(MAX_LOCAL_DOCUMENT_BYTES + 1)], "large.pdf", { type: "application/pdf" }), "too_large"],
  [new File(["x"], "result.csv", { type: "text/csv" }), "unsupported"],
  [new File(["x"], "mismatch.pdf", { type: "image/png" }), "unsupported"],
] as const)("rejects invalid local file boundaries", (file, code) => {
  try {
    validateLocalDocument(file);
    throw new Error("expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(LocalDocumentError);
    expect((error as LocalDocumentError).code).toBe(code);
  }
});

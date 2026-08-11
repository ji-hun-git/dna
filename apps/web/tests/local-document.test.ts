import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import {
  inspectLocalDocument,
  LocalDocumentError,
  MAX_LOCAL_DOCUMENT_BYTES,
  validateLocalDocument,
} from "@/lib/imports/local-document";

it("validates and fingerprints an allowed document without retaining its name", async () => {
  const body = "synthetic health result";
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

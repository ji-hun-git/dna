export const MAX_LOCAL_DOCUMENT_BYTES = 20 * 1024 * 1024;

const allowedDocuments = {
  pdf: { mimeTypes: ["application/pdf"], label: "PDF" },
  png: { mimeTypes: ["image/png"], label: "PNG" },
  jpg: { mimeTypes: ["image/jpeg"], label: "JPEG" },
  jpeg: { mimeTypes: ["image/jpeg"], label: "JPEG" },
} as const;

export type LocalDocumentReceipt = {
  format: "PDF" | "PNG" | "JPEG";
  byteLength: number;
  sizeLabel: string;
  sha256: `sha256:${string}`;
  processingBoundary: "local-synthetic-fixture";
};

export type LocalDocumentErrorCode = "empty" | "too_large" | "unsupported" | "content_mismatch" | "unreadable";

export class LocalDocumentError extends Error {
  constructor(public readonly code: LocalDocumentErrorCode, message: string) {
    super(message);
    this.name = "LocalDocumentError";
  }
}

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function formatSize(byteLength: number) {
  if (byteLength < 1024 * 1024) return `${Math.max(1, Math.round(byteLength / 1024))} KB`;
  return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

function assertDocumentSignature(bytes: ArrayBuffer, format: "PDF" | "PNG" | "JPEG") {
  const view = new Uint8Array(bytes);
  const matches = format === "PDF"
    ? startsWith(view, [0x25, 0x50, 0x44, 0x46, 0x2d])
    : format === "PNG"
      ? startsWith(view, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : startsWith(view, [0xff, 0xd8, 0xff]);
  if (!matches) {
    throw new LocalDocumentError(
      "content_mismatch",
      "파일 내용이 확장자와 맞지 않아요. 원본 PDF, PNG, JPEG 파일을 선택해 주세요.",
    );
  }
}

function readFileBytes(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("unexpected file reader result"));
    };
    reader.readAsArrayBuffer(file);
  });
}

export function validateLocalDocument(file: File) {
  if (file.size < 1) {
    throw new LocalDocumentError("empty", "내용이 없는 파일은 가져올 수 없어요.");
  }
  if (file.size > MAX_LOCAL_DOCUMENT_BYTES) {
    throw new LocalDocumentError("too_large", "파일은 20MB 이하여야 해요.");
  }

  const extension = extensionOf(file.name) as keyof typeof allowedDocuments;
  const documentType = allowedDocuments[extension];
  const mimeTypes = documentType?.mimeTypes as readonly string[] | undefined;
  if (!documentType || (file.type !== "" && !mimeTypes?.includes(file.type))) {
    throw new LocalDocumentError("unsupported", "PDF, PNG, JPEG 파일만 선택할 수 있어요.");
  }

  return { format: documentType.label, sizeLabel: formatSize(file.size) };
}

export async function inspectLocalDocument(file: File): Promise<LocalDocumentReceipt> {
  const validated = validateLocalDocument(file);
  try {
    const bytes = await readFileBytes(file);
    assertDocumentSignature(bytes, validated.format);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return {
      format: validated.format,
      byteLength: file.size,
      sizeLabel: validated.sizeLabel,
      sha256: `sha256:${bytesToHex(digest)}`,
      processingBoundary: "local-synthetic-fixture",
    };
  } catch (error) {
    if (error instanceof LocalDocumentError) throw error;
    throw new LocalDocumentError("unreadable", "이 기기에서 파일을 확인하지 못했어요. 다시 선택해 주세요.");
  }
}

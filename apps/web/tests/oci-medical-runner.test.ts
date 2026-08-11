import { afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixtureManifest from "./fixtures/medical-ai/offline-runner.fixture-manifest.json";
import {
  assessOciHostReadiness,
  buildOfflineDockerInvocation,
  medicalModelArtifactReceiptSchema,
  medicalModelContentManifestSchema,
} from "@/lib/medical-ai/oci-runner";
import { createOfflineRunnerJob, sha256Of } from "@/lib/medical-ai/offline-runner";
import { medicalDocumentOciApprovalSchema } from "@/lib/medical-ai/runner-contracts";
import { createSignedApprovalFixture } from "./helpers/signed-oci-approval";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const digestBytes = (value: Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function createArtifact(args: {
  base: string;
  role: "layout" | "semantic";
  model: typeof fixtureManifest.models.layout;
}) {
  const root = join(args.base, args.role);
  const relativePath = "weights/model.bin";
  const filePath = join(root, "weights", "model.bin");
  const bytes = Buffer.from(`${args.role}-fixture-model-bytes`, "utf8");
  await mkdir(join(root, "weights"), { recursive: true });
  await writeFile(filePath, bytes);

  const contentManifest = medicalModelContentManifestSchema.parse({
    schemaVersion: "medical-model-content-manifest.v1",
    model: args.model,
    files: [{ path: relativePath, sha256: digestBytes(bytes), byteLength: bytes.byteLength }],
  });
  await writeFile(join(root, "gc-model-content-manifest.json"), `${JSON.stringify(contentManifest, null, 2)}\n`, "utf8");

  const shared = {
    schemaVersion: "medical-model-artifact-receipt.v1",
    artifactRole: args.role,
    model: args.model,
    contentManifestSha256: sha256Of(contentManifest),
    byteLength: bytes.byteLength,
    fileCount: 1,
    sourceRevision: (args.role === "layout" ? "1" : "2").repeat(40),
  };
  const receipt = medicalModelArtifactReceiptSchema.parse(args.role === "layout" ? {
    ...shared,
    license: {
      licenseFamily: "Apache-2.0",
      licenseUrl: "https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE",
      licenseSnapshotSha256: digest("b"),
      reviewedAt: "2026-08-12T02:00:00+09:00",
    },
  } : {
    ...shared,
    license: {
      licenseFamily: "HAI-DEF",
      termsUrl: "https://developers.google.com/health-ai-developer-foundations/terms",
      termsSnapshotSha256: digest("d"),
      prohibitedUsePolicyUrl: "https://developers.google.com/health-ai-developer-foundations/prohibited-use-policy",
      prohibitedUsePolicySha256: digest("e"),
      acceptanceReceiptSha256: digest("f"),
      acceptedAt: "2026-08-12T02:00:00+09:00",
      approvedUse: "candidate-extraction-evaluation-only",
    },
  });
  return { root, filePath, receipt };
}

async function productionContract() {
  const base = await mkdtemp(join(tmpdir(), "gc-oci-contract-"));
  temporaryRoots.push(base);
  const manifest = { ...fixtureManifest, approvalStatus: "production-reviewed" as const };
  const inputRoot = join(base, "input");
  const outputRoot = join(base, "output");
  await mkdir(inputRoot);
  await mkdir(outputRoot);

  const documentBytes = Buffer.from("synthetic-health-screening-pdf-fixture", "utf8");
  const job = createOfflineRunnerJob({
    manifest,
    jobId: "job-oci-contract-001",
    document: {
      documentId: "synthetic-checkup-001",
      documentSha256: digestBytes(documentBytes),
      documentType: "health-screening-lab-report",
      mimeType: "application/pdf",
      byteLength: documentBytes.byteLength,
      inputHandle: "job-input:oci-contract-001",
    },
    outputHandle: "job-output:oci-contract-001",
    requestedAt: "2026-08-12T02:01:00+09:00",
    expiresAt: "2026-08-12T02:11:00+09:00",
  });
  await writeFile(join(inputRoot, "document.bin"), documentBytes);
  await writeFile(join(inputRoot, "job.json"), `${JSON.stringify(job, null, 2)}\n`, "utf8");

  const layout = await createArtifact({ base, role: "layout", model: manifest.models.layout });
  const semantic = await createArtifact({ base, role: "semantic", model: manifest.models.semantic });
  const approval = {
    schemaVersion: "medical-document-oci-approval.v1",
    approvalId: "oci-approval-contract-001",
    manifestSha256: job.manifestSha256,
    runnerImage: manifest.runnerImage,
    layoutReceiptSha256: sha256Of(layout.receipt),
    semanticReceiptSha256: sha256Of(semantic.receipt),
    approvedUse: "candidate-extraction-evaluation-only",
    approvalAuthority: "founder-approved-workflow",
    approvedAt: "2026-08-12T02:00:00+09:00",
    expiresAt: "2026-08-12T03:00:00+09:00",
  };
  const signedApproval = createSignedApprovalFixture(approval);
  const bindings = {
    inputRoot,
    outputRoot,
    layoutModelRoot: layout.root,
    semanticModelRoot: semantic.root,
  };
  return {
    manifest,
    layoutReceipt: layout.receipt,
    semanticReceipt: semantic.receipt,
    layoutModelFile: layout.filePath,
    semanticModelFile: semantic.filePath,
    job,
    approval,
    verifiedApproval: signedApproval.verifiedApproval,
    bindings,
  };
}

it("rehashes all mounted bytes before building a shell-free, network-free Docker invocation", async () => {
  const contract = await productionContract();
  const invocation = await buildOfflineDockerInvocation(contract);

  expect(invocation.executable).toBe("docker");
  expect(invocation.args).toEqual(expect.arrayContaining([
    "--pull=never",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges=true",
    "--gpus=device=0",
  ]));
  expect(invocation.args.filter((argument) => argument.startsWith("--env="))).toEqual([
    "--env=GC_JOB_ID=job-oci-contract-001",
    "--env=GC_INPUT_HANDLE=job-input:oci-contract-001",
    "--env=GC_OUTPUT_HANDLE=job-output:oci-contract-001",
  ]);
  expect(invocation.args).not.toContain(expect.stringContaining("HF_TOKEN"));
  expect(invocation.args.at(-1)).toBe(contract.manifest.runnerImage);
  expect(invocation.redactedSummary).not.toHaveProperty("inputRoot");
  expect(invocation.redactedSummary.output).toBe("isolated-read-write");
  expect(invocation.redactedSummary.approvalCoordinateSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
});

it("rejects fixture approval, artifact substitution, approval drift, and unsafe paths", async () => {
  const contract = await productionContract();
  await expect(buildOfflineDockerInvocation({ ...contract, manifest: fixtureManifest })).rejects.toThrow("production-reviewed");
  await expect(buildOfflineDockerInvocation({
    ...contract,
    verifiedApproval: contract.approval,
  })).rejects.toThrow("authenticated approval envelope");
  await expect(buildOfflineDockerInvocation({
    ...contract,
    semanticReceipt: {
      ...contract.semanticReceipt,
      model: { ...contract.semanticReceipt.model, artifactSha256: digest("9") },
    },
  })).rejects.toThrow("semantic artifact receipt");
  await expect(buildOfflineDockerInvocation({
    ...contract,
    semanticReceipt: { ...contract.semanticReceipt, contentManifestSha256: digest("9") },
  })).rejects.toThrow("artifact receipts");
  await expect(buildOfflineDockerInvocation({
    ...contract,
    bindings: { ...contract.bindings, inputRoot: "relative\\input" },
  })).rejects.toThrow("absolute");
  await expect(buildOfflineDockerInvocation({
    ...contract,
    bindings: { ...contract.bindings, inputRoot: "C:\\unsafe,path" },
  })).rejects.toThrow("forbidden character");
  await expect(buildOfflineDockerInvocation({
    ...contract,
    bindings: { ...contract.bindings, outputRoot: join(contract.bindings.inputRoot, "nested-output") },
  })).rejects.toThrow("may not overlap");
  const shortApproval = createSignedApprovalFixture({
    ...contract.approval,
    expiresAt: "2026-08-12T02:05:00+09:00",
  });
  await expect(buildOfflineDockerInvocation({
    ...contract,
    verifiedApproval: shortApproval.verifiedApproval,
  })).rejects.toThrow("complete job window");
  expect(medicalDocumentOciApprovalSchema.safeParse({
    ...contract.approval,
    approvalAuthority: "caller",
  }).success).toBe(false);
});

it("rejects changed or extra model bytes, changed job bytes, and dirty output roots", async () => {
  const tampered = await productionContract();
  await writeFile(tampered.semanticModelFile, "tampered-semantic-model", "utf8");
  await expect(buildOfflineDockerInvocation(tampered)).rejects.toThrow(/metadata mismatch|file digest mismatch/);

  const extra = await productionContract();
  await writeFile(join(extra.bindings.layoutModelRoot, "extra.bin"), "extra", "utf8");
  await expect(buildOfflineDockerInvocation(extra)).rejects.toThrow("unapproved files");

  const wrongJob = await productionContract();
  await writeFile(join(wrongJob.bindings.inputRoot, "job.json"), "{}", "utf8");
  await expect(buildOfflineDockerInvocation(wrongJob)).rejects.toThrow();

  const wrongDocument = await productionContract();
  await writeFile(
    join(wrongDocument.bindings.inputRoot, "document.bin"),
    Buffer.alloc(wrongDocument.job.input.byteLength, "x"),
  );
  await expect(buildOfflineDockerInvocation(wrongDocument)).rejects.toThrow("document.bin digest");

  const dirtyOutput = await productionContract();
  await writeFile(join(dirtyOutput.bindings.outputRoot, "old-result.json"), "{}", "utf8");
  await expect(buildOfflineDockerInvocation(dirtyOutput)).rejects.toThrow("must be empty");
});

it("reports Docker, VRAM, and compute-capability blockers without claiming model readiness", () => {
  expect(assessOciHostReadiness({
    nvidiaSmiCsv: "NVIDIA GeForce RTX 3070, 610.74, 8192 MiB, 8.6",
  })).toMatchObject({
    scope: "host-only",
    hostReadyForOciBoundary: false,
    modelArtifactsChecked: false,
    licenseApprovalChecked: false,
    approvalAuthenticationChecked: false,
    blockers: ["docker-runtime-unavailable"],
  });
  expect(assessOciHostReadiness({
    dockerServerVersion: "28.0.0",
    nvidiaSmiCsv: "NVIDIA GeForce RTX 3060, 610.74, 4096 MiB, 8.6",
  }).blockers).toContain("gpu-vram-below-8192-mib");
  expect(assessOciHostReadiness({
    dockerServerVersion: "28.0.0",
    nvidiaSmiCsv: "NVIDIA GeForce RTX 3070, 610.74, 8192 MiB, 8.6",
  })).toMatchObject({ hostReadyForOciBoundary: true, blockers: [] });
  expect(assessOciHostReadiness({
    dockerServerVersion: "18.09.0",
    nvidiaSmiCsv: "NVIDIA GeForce RTX 3070, 610.74, 8192 MiB, 8.6",
  }).blockers).toContain("docker-version-below-19.03");
});

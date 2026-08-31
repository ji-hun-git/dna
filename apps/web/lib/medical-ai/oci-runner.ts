import { z } from "zod";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { offlineRunnerJobSchema, offlineRunnerManifestSchema } from "./runner-contracts.ts";
import { pinnedModelSchema } from "./contracts.ts";
import { sha256Of } from "./offline-runner.ts";
import { unwrapVerifiedOciApproval } from "./approval-verifier.ts";

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const apacheLicenseUrl = "https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE";
const medGemmaTermsUrl = "https://developers.google.com/health-ai-developer-foundations/terms";
const medGemmaProhibitedUseUrl = "https://developers.google.com/health-ai-developer-foundations/prohibited-use-policy";
const contentManifestName = "gc-model-content-manifest.json";

const contentFileSchema = z.strictObject({
  path: z.string().regex(/^[A-Za-z0-9._/-]+$/).refine(
    (value) => !value.startsWith("/") && !value.split("/").includes("..") && value !== contentManifestName,
    "content path must be relative and may not escape its model root",
  ),
  sha256: sha256Schema,
  byteLength: z.number().int().positive(),
});

export const medicalModelContentManifestSchema = z.strictObject({
  schemaVersion: z.literal("medical-model-content-manifest.v1"),
  model: pinnedModelSchema,
  files: z.array(contentFileSchema).min(1).max(10_000),
}).superRefine((manifest, context) => {
  const paths = manifest.files.map((file) => file.path);
  const sorted = [...paths].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (new Set(paths).size !== paths.length || paths.some((path, index) => path !== sorted[index])) {
    context.addIssue({ code: "custom", message: "content manifest paths must be unique and sorted" });
  }
});

const apacheLicenseReceiptSchema = z.strictObject({
  licenseFamily: z.literal("Apache-2.0"),
  licenseUrl: z.literal(apacheLicenseUrl),
  licenseSnapshotSha256: sha256Schema,
  reviewedAt: z.string().datetime({ offset: true }),
});

const medGemmaLicenseReceiptSchema = z.strictObject({
  licenseFamily: z.literal("HAI-DEF"),
  termsUrl: z.literal(medGemmaTermsUrl),
  termsSnapshotSha256: sha256Schema,
  prohibitedUsePolicyUrl: z.literal(medGemmaProhibitedUseUrl),
  prohibitedUsePolicySha256: sha256Schema,
  acceptanceReceiptSha256: sha256Schema,
  acceptedAt: z.string().datetime({ offset: true }),
  approvedUse: z.literal("candidate-extraction-evaluation-only"),
});

export const medicalModelArtifactReceiptSchema = z.discriminatedUnion("artifactRole", [
  z.strictObject({
    schemaVersion: z.literal("medical-model-artifact-receipt.v1"),
    artifactRole: z.literal("layout"),
    model: pinnedModelSchema,
    contentManifestSha256: sha256Schema,
    byteLength: z.number().int().positive(),
    fileCount: z.number().int().positive(),
    sourceRevision: z.string().regex(/^[0-9a-f]{40}$/),
    license: apacheLicenseReceiptSchema,
  }),
  z.strictObject({
    schemaVersion: z.literal("medical-model-artifact-receipt.v1"),
    artifactRole: z.literal("semantic"),
    model: pinnedModelSchema,
    contentManifestSha256: sha256Schema,
    byteLength: z.number().int().positive(),
    fileCount: z.number().int().positive(),
    sourceRevision: z.string().regex(/^[0-9a-f]{40}$/),
    license: medGemmaLicenseReceiptSchema,
  }),
]);

const hostPathSchema = z.string().min(1).superRefine((value, context) => {
  if (/[\0\r\n,]/.test(value)) context.addIssue({ code: "custom", message: "host path contains a forbidden character" });
  if (!/^(?:[A-Za-z]:\\|\/)/.test(value)) context.addIssue({ code: "custom", message: "host path must be absolute" });
});

export const offlineDockerBindingSchema = z.strictObject({
  inputRoot: hostPathSchema,
  outputRoot: hostPathSchema,
  layoutModelRoot: hostPathSchema,
  semanticModelRoot: hostPathSchema,
}).superRefine((value, context) => {
  const roots = Object.values(value).map((root) => resolve(root).toLowerCase().replace(/[\\/]+$/, ""));
  if (new Set(roots).size !== roots.length) context.addIssue({ code: "custom", message: "runner mount roots must be distinct" });
  if (roots.some((root, index) => roots.some((other, otherIndex) => (
    index !== otherIndex && root.startsWith(`${other}${sep}`)
  )))) {
    context.addIssue({ code: "custom", message: "runner mount roots may not overlap" });
  }
});

export type MedicalModelArtifactReceipt = z.infer<typeof medicalModelArtifactReceiptSchema>;

function assertReceiptMatchesModel(
  receipt: MedicalModelArtifactReceipt,
  expectedRole: "layout" | "semantic",
  expectedModel: { modelId: string; artifactSha256: string; executionMode: string },
) {
  if (receipt.artifactRole !== expectedRole
    || receipt.model.modelId !== expectedModel.modelId
    || receipt.model.artifactSha256 !== expectedModel.artifactSha256
    || receipt.model.executionMode !== expectedModel.executionMode) {
    throw new Error(`${expectedRole} artifact receipt does not match the manifest`);
  }
}

function dockerMount(source: string, target: string, readOnly: boolean): string {
  return `type=bind,src=${source},dst=${target}${readOnly ? ",readonly" : ""}`;
}

async function sha256File(path: string): Promise<`sha256:${string}`> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  return `sha256:${hash.digest("hex")}`;
}

async function assertRegularDirectory(path: string, label: string) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
}

async function listArtifactFiles(root: string, current = root): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error("model artifact may not contain symbolic links");
    if (entry.isDirectory()) files.push(...await listArtifactFiles(root, absolute));
    else if (entry.isFile()) files.push(relative(root, absolute).split(sep).join("/"));
    else throw new Error("model artifact may contain only directories and regular files");
  }
  return files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

async function verifyLocalModelArtifact(rootInput: string, receipt: MedicalModelArtifactReceipt) {
  const root = resolve(rootInput);
  await assertRegularDirectory(root, `${receipt.artifactRole} model root`);
  const manifestPath = join(root, contentManifestName);
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 1_048_576) {
    throw new Error(`${receipt.artifactRole} content manifest is not an admissible file`);
  }
  const manifest = medicalModelContentManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  if (sha256Of(manifest) !== receipt.contentManifestSha256) throw new Error(`${receipt.artifactRole} content manifest digest mismatch`);
  if (sha256Of(manifest.model) !== sha256Of(receipt.model)) throw new Error(`${receipt.artifactRole} content manifest model mismatch`);
  if (manifest.files.length !== receipt.fileCount
    || manifest.files.reduce((total, file) => total + file.byteLength, 0) !== receipt.byteLength) {
    throw new Error(`${receipt.artifactRole} content manifest totals mismatch`);
  }

  const actualPaths = (await listArtifactFiles(root)).filter((path) => path !== contentManifestName);
  if (actualPaths.length !== manifest.files.length
    || actualPaths.some((path, index) => path !== manifest.files[index].path)) {
    throw new Error(`${receipt.artifactRole} model root contains unapproved files`);
  }
  for (const file of manifest.files) {
    const absolute = resolve(root, ...file.path.split("/"));
    if (!absolute.startsWith(`${root}${sep}`)) throw new Error("content path escaped the model root");
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.byteLength) {
      throw new Error(`${receipt.artifactRole} model file metadata mismatch`);
    }
    if (await sha256File(absolute) !== file.sha256) throw new Error(`${receipt.artifactRole} model file digest mismatch`);
  }
}

async function verifyJobDirectories(bindings: z.infer<typeof offlineDockerBindingSchema>, job: z.infer<typeof offlineRunnerJobSchema>) {
  await assertRegularDirectory(bindings.inputRoot, "job input root");
  await assertRegularDirectory(bindings.outputRoot, "job output root");
  if ((await readdir(bindings.outputRoot)).length !== 0) throw new Error("job output root must be empty before launch");

  const inputNames = (await readdir(bindings.inputRoot)).sort();
  if (inputNames.length !== 2 || inputNames[0] !== "document.bin" || inputNames[1] !== "job.json") {
    throw new Error("job input root must contain exactly document.bin and job.json");
  }
  const jobPath = join(bindings.inputRoot, "job.json");
  const documentPath = join(bindings.inputRoot, "document.bin");
  const jobStat = await lstat(jobPath);
  const documentStat = await lstat(documentPath);
  if (!jobStat.isFile() || jobStat.isSymbolicLink() || jobStat.size > 1_048_576) throw new Error("job.json is not admissible");
  if (!documentStat.isFile() || documentStat.isSymbolicLink() || documentStat.size !== job.input.byteLength) {
    throw new Error("document.bin metadata does not match the job");
  }
  const storedJob = offlineRunnerJobSchema.parse(JSON.parse(await readFile(jobPath, "utf8")));
  if (sha256Of(storedJob) !== sha256Of(job)) throw new Error("job.json does not match the approved job");
  if (await sha256File(documentPath) !== job.input.documentSha256) throw new Error("document.bin digest does not match the job");
}

export async function buildOfflineDockerInvocation(args: {
  manifest: unknown;
  job: unknown;
  verifiedApproval: unknown;
  layoutReceipt: unknown;
  semanticReceipt: unknown;
  bindings: unknown;
}) {
  const manifest = offlineRunnerManifestSchema.parse(args.manifest);
  const job = offlineRunnerJobSchema.parse(args.job);
  const verifiedApproval = unwrapVerifiedOciApproval(args.verifiedApproval);
  const approval = verifiedApproval.approval;
  const layoutReceipt = medicalModelArtifactReceiptSchema.parse(args.layoutReceipt);
  const semanticReceipt = medicalModelArtifactReceiptSchema.parse(args.semanticReceipt);
  const bindings = offlineDockerBindingSchema.parse(args.bindings);

  if (manifest.approvalStatus !== "production-reviewed") throw new Error("OCI execution requires a production-reviewed manifest");
  if (manifest.execution.outputMount !== "isolated-read-write") throw new Error("OCI output mount contract is unsupported");
  if (job.manifestSha256 !== sha256Of(manifest)) throw new Error("job manifest digest mismatch");
  if (approval.manifestSha256 !== job.manifestSha256 || approval.runnerImage !== manifest.runnerImage) {
    throw new Error("OCI approval does not match the runner manifest");
  }
  assertReceiptMatchesModel(layoutReceipt, "layout", manifest.models.layout);
  assertReceiptMatchesModel(semanticReceipt, "semantic", manifest.models.semantic);
  if (layoutReceipt.artifactRole !== "layout" || semanticReceipt.artifactRole !== "semantic") {
    throw new Error("artifact receipt roles are invalid");
  }
  if (approval.layoutReceiptSha256 !== sha256Of(layoutReceipt)
    || approval.semanticReceiptSha256 !== sha256Of(semanticReceipt)) {
    throw new Error("OCI approval does not match the artifact receipts");
  }
  const approvalTime = Date.parse(approval.approvedAt);
  if (approvalTime < Date.parse(layoutReceipt.license.reviewedAt)
    || approvalTime < Date.parse(semanticReceipt.license.acceptedAt)) {
    throw new Error("OCI approval predates a required license receipt");
  }
  if (Date.parse(job.requestedAt) < approvalTime || Date.parse(job.expiresAt) > Date.parse(approval.expiresAt)) {
    throw new Error("OCI approval does not cover the complete job window");
  }
  await verifyJobDirectories(bindings, job);
  await verifyLocalModelArtifact(bindings.layoutModelRoot, layoutReceipt);
  await verifyLocalModelArtifact(bindings.semanticModelRoot, semanticReceipt);

  const invocation = {
    executable: "docker" as const,
    args: [
      "run",
      "--rm",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges=true",
      "--user=65532:65532",
      "--workdir=/work",
      "--pids-limit=256",
      "--cpus=4",
      "--memory=12g",
      "--shm-size=1g",
      "--stop-timeout=5",
      "--gpus=device=0",
      "--tmpfs=/tmp:rw,noexec,nosuid,size=268435456",
      `--mount=${dockerMount(bindings.inputRoot, "/work/input", true)}`,
      `--mount=${dockerMount(bindings.outputRoot, "/work/output", false)}`,
      `--mount=${dockerMount(bindings.layoutModelRoot, "/opt/gc/models/layout", true)}`,
      `--mount=${dockerMount(bindings.semanticModelRoot, "/opt/gc/models/semantic", true)}`,
      `--env=GC_JOB_ID=${job.jobId}`,
      `--env=GC_INPUT_HANDLE=${job.input.inputHandle}`,
      `--env=GC_OUTPUT_HANDLE=${job.output.outputHandle}`,
      manifest.runnerImage,
    ],
    redactedSummary: {
      schemaVersion: "medical-document-oci-invocation-summary.v1" as const,
      jobId: job.jobId,
      manifestSha256: job.manifestSha256,
      approvalId: approval.approvalId,
      approvalCoordinateSha256: sha256Of(verifiedApproval.coordinate),
      trustAnchorSha256: verifiedApproval.trustAnchorSha256,
      runnerImage: manifest.runnerImage,
      networkMode: "none" as const,
      inputAndModels: "read-only" as const,
      output: "isolated-read-write" as const,
      gpuDevice: "0" as const,
      environmentKeys: [...manifest.execution.environmentAllowlist],
    },
  };
  return invocation;
}

export function assessOciHostReadiness(input: { dockerServerVersion?: string; nvidiaSmiCsv?: string }) {
  const blockers: string[] = [];
  if (!input.dockerServerVersion?.trim()) blockers.push("docker-runtime-unavailable");
  else if (Number(input.dockerServerVersion.trim().split(".")[0]) < 19) blockers.push("docker-version-below-19.03");

  const firstGpu = input.nvidiaSmiCsv?.trim().split(/\r?\n/, 1)[0];
  const match = firstGpu?.match(/^(.+),\s*([0-9.]+),\s*([0-9]+) MiB,\s*([0-9.]+)$/);
  const gpu = match ? {
    name: match[1].trim(),
    driverVersion: match[2],
    memoryMiB: Number(match[3]),
    computeCapability: match[4],
  } : null;
  if (!gpu) blockers.push("supported-nvidia-gpu-unavailable");
  else if (gpu.memoryMiB < 8192) blockers.push("gpu-vram-below-8192-mib");
  else if (Number(gpu.computeCapability) < 8) blockers.push("gpu-compute-capability-below-8.0");

  return {
    schemaVersion: "medical-document-oci-host-preflight.v1" as const,
    scope: "host-only" as const,
    hostReadyForOciBoundary: blockers.length === 0,
    dockerServerVersion: input.dockerServerVersion?.trim() || null,
    gpu,
    blockers,
    modelArtifactsChecked: false as const,
    licenseApprovalChecked: false as const,
    approvalAuthenticationChecked: false as const,
  };
}

export const medicalAiOfficialSources = {
  paddleOcrLicense: apacheLicenseUrl,
  medGemmaTerms: medGemmaTermsUrl,
  medGemmaProhibitedUsePolicy: medGemmaProhibitedUseUrl,
} as const;

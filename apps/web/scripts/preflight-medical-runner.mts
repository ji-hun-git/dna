import { spawnSync } from "node:child_process";
import { assessOciHostReadiness } from "../lib/medical-ai/oci-runner.ts";

function output(command: string, args: string[]): string | undefined {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout: 5_000 });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

const report = assessOciHostReadiness({
  dockerServerVersion: output("docker", ["version", "--format", "{{.Server.Version}}"]),
  nvidiaSmiCsv: output("nvidia-smi", [
    "--query-gpu=name,driver_version,memory.total,compute_cap",
    "--format=csv,noheader",
  ]),
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

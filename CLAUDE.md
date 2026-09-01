# Compatibility resumption guide

This repository is no longer planning-only. The canonical resumption and operating guide is:

> [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md)

Read it before making a change. Then read `release/readiness.json`, the relevant ADR/operations
document, and the nearest `AGENTS.md`.

Use [`SANITY_CHECK_PROMPT.md`](SANITY_CHECK_PROMPT.md) to start an evidence-first takeover audit.

Current non-negotiable facts as of 2026-09-02:

- release target: `HOSTED_SYNTHETIC_STAGING`;
- release verdict: `NO_GO`;
- synthetic fixtures and rights-reviewed public metadata only;
- no hosted application deployment or AWS plan/apply;
- no Kakao/Naver/MyHealthWay/NHIS/HIRA or real-PHI activation;
- the first signed/attested GHCR publication succeeded, but all three packages are anonymously
  pullable and therefore stop-ship until a separately approved remediation;
- no diagnostic, normality, risk, treatment, medication, or autonomous clinical claim.

Do not infer execution from a plan, workflow, IaC file, dependency, mock, or UI. Require exact live
evidence, keep unrelated user changes intact, and stop when new external or destructive authority is
required.

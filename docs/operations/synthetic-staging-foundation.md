# Synthetic hosted-staging foundation

**Current state:** OpenTofu code and tests exist; no `plan` against an account and no `apply` has been performed. Nothing in this document is evidence that hosted staging is live.

The `infra/modules/synthetic-staging` module defines an inert AWS Seoul (`ap-northeast-2`) boundary for a dedicated non-production account. The live composition is `infra/live/synthetic-staging`.

## Defined resources and boundaries

- Three private, immutable, scan-on-push, KMS-encrypted ECR repositories.
- Independent `untrusted`, `approved`, and `preview` S3 buckets with public access blocked, bucket-owner enforcement, versioning, TLS-only policies, exact per-zone KMS keys, and bounded synthetic retention.
- An encrypted SQS document queue and DLQ with bounded retry and long polling.
- Separate core and document-worker task roles. The worker can read source zones, write only safe previews, and consume only the document queue.
- A GitHub OIDC registry-publisher role restricted to the exact repository and protected environment; no access key is created.
- Empty Secrets Manager containers only. Secret values and secret versions are deliberately absent from OpenTofu state.
- KMS-encrypted CloudWatch log groups and payload-free queue-age/DLQ alarms.
- Mandatory tags declaring `DataClass=synthetic-only`, `PhiPermitted=false`, and `ProviderEnabled=false`.

The module fails validation if the provider account differs from the declared account, the provider region is not Seoul, or the GitHub OIDC provider belongs to another account.

## Deliberate gaps

- No VPC, egress policy, load balancer, TLS certificate, WAF, ECS service, RDS database, DNS record, backup vault, or external audit anchor is created yet.
- The application still uses its local filesystem storage boundary and PostgreSQL job leases. Production S3 and SQS runtime adapters do not yet exist.
- Empty task roles and secret containers are prerequisites, not workload-identity or secret-injection evidence.
- ECR repositories are a future private AWS registry boundary. Protected GHCR publication run 33370021596 succeeded, but the three resulting packages are anonymously pullable and therefore stop-ship under the intended private-package policy. No ECR repository has been created because this OpenTofu foundation remains unapplied.
- No real-data, provider, or medical-AI path is permitted.

## Validation contract

CI installs checksum-verified OpenTofu 1.10.6, consumes the committed AWS provider 6.10.0 lockfiles, checks formatting, validates both infrastructure modules and the live composition, and runs the module tests. Tests assert the synthetic tags, immutable/encrypted registries, S3 public-access and encryption denial policies, bounded retention, queue/DLQ settings, workload-role limits, log KMS context, empty secret containers, and account/region fail-closed checks.

## Founder input — not needed yet

Before the first account-backed `plan`, provide only:

- the 12-digit ID of a dedicated AWS non-production account;
- the GitHub Actions OIDC provider ARN in that same account;
- a separately bootstrapped private S3 state bucket and state-lock policy in Seoul.

Do not provide access keys in chat or commit them. Use an approved short-lived AWS identity. The first account-backed operation should be a reviewed `plan`; `apply` remains a separate approval after the runtime S3/SQS adapters and network boundary exist.

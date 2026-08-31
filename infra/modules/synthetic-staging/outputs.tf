output "runtime_repository_urls" {
  description = "Private immutable ECR repository URLs. Deployments must still use repository@sha256:digest."
  value       = { for name, repository in aws_ecr_repository.runtime : name => repository.repository_url }
}

output "storage_zone_buckets" {
  description = "Synthetic-only trust-zone bucket names."
  value       = { for name, bucket in aws_s3_bucket.zone : name => bucket.id }
}

output "document_queue" {
  description = "Document queue and DLQ coordinates without message content."
  value = {
    queue_arn = aws_sqs_queue.document.arn
    queue_url = aws_sqs_queue.document.id
    dlq_arn   = aws_sqs_queue.dead_letter.arn
    dlq_url   = aws_sqs_queue.dead_letter.id
  }
}

output "registry_publisher_role_arn" {
  description = "Short-lived GitHub OIDC role; no access key is created."
  value       = aws_iam_role.registry_publisher.arn
}

output "runtime_task_role_arns" {
  description = "Future task identities. No ECS service is created or activated by this module."
  value = {
    core_api        = aws_iam_role.core_task.arn
    document_worker = aws_iam_role.worker_task.arn
  }
}

output "runtime_secret_arns" {
  description = "Empty secret containers; values and VersionIds must be created outside OpenTofu state."
  value       = { for name, secret in aws_secretsmanager_secret.runtime : name => secret.arn }
}

resource "aws_secretsmanager_secret" "runtime" {
  for_each = toset([
    "database-credentials",
    "worker-credential",
    "audit-pepper",
  ])

  name                    = "${var.project_name}/${each.key}"
  description             = "Empty staging secret container; create an exact version only through the deployment authority."
  kms_key_id              = aws_kms_key.boundary["secrets"].arn
  recovery_window_in_days = 30

  tags = merge(local.common_tags, { SecretPurpose = each.key })
}

# Secret values are deliberately absent. OpenTofu state must never contain the
# database password, worker credential, audit pepper, provider key, or token.

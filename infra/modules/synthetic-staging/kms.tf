resource "aws_kms_key" "boundary" {
  for_each = local.kms_purposes

  description             = "${var.project_name} ${each.key} boundary"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid       = "AccountRootDelegatesOnlyThroughIAM"
          Effect    = "Allow"
          Principal = { AWS = "arn:aws:iam::${var.aws_account_id}:root" }
          Action    = "kms:*"
          Resource  = "*"
        },
      ],
      each.key == "logs" ? [
        {
          Sid       = "AllowOnlyThisAccountsRuntimeLogGroups"
          Effect    = "Allow"
          Principal = { Service = "logs.${var.aws_region}.amazonaws.com" }
          Action = [
            "kms:Decrypt",
            "kms:DescribeKey",
            "kms:Encrypt",
            "kms:GenerateDataKey*",
            "kms:ReEncrypt*",
          ]
          Resource = "*"
          Condition = {
            ArnLike = {
              "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/${var.project_name}/*"
            }
          }
        },
      ] : [],
    )
  })

  tags = merge(local.common_tags, { Boundary = each.key })
}

resource "aws_kms_alias" "boundary" {
  for_each = local.kms_purposes

  name          = "alias/${var.project_name}-${each.key}"
  target_key_id = aws_kms_key.boundary[each.key].key_id
}

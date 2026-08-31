resource "aws_iam_role" "registry_publisher" {
  name                 = "${var.project_name}-registry-publisher"
  max_session_duration = 3600
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GitHubProtectedEnvironmentOnly"
        Effect = "Allow"
        Principal = {
          Federated = var.github_oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = local.oidc_subject
          }
        }
      },
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "registry_publisher" {
  name = "immutable-runtime-image-publish"
  role = aws_iam_role.registry_publisher.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "RegistryLogin"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "PublishOnlyApprovedRuntimeRepositories"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = [for repository in aws_ecr_repository.runtime : repository.arn]
      },
    ]
  })
}

resource "aws_iam_role" "core_task" {
  name                 = "${var.project_name}-core-task"
  max_session_duration = 3600
  assume_role_policy   = local.ecs_task_assume_role_policy
  tags                 = merge(local.common_tags, { Runtime = "core-api" })
}

resource "aws_iam_role" "worker_task" {
  name                 = "${var.project_name}-worker-task"
  max_session_duration = 3600
  assume_role_policy   = local.ecs_task_assume_role_policy
  tags                 = merge(local.common_tags, { Runtime = "document-worker" })
}

locals {
  ecs_task_assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action    = "sts:AssumeRole"
        Condition = {
          ArnLike      = { "aws:SourceArn" = "arn:aws:ecs:${var.aws_region}:${var.aws_account_id}:*" }
          StringEquals = { "aws:SourceAccount" = var.aws_account_id }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy" "core_task" {
  name = "core-document-orchestration"
  role = aws_iam_role.core_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CoreObjectLifecycle"
        Effect = "Allow"
        Action = [
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
        ]
        Resource = flatten([
          for bucket in aws_s3_bucket.zone : ["${bucket.arn}/*"]
        ])
      },
      {
        Sid      = "CoreQueuePublish"
        Effect   = "Allow"
        Action   = ["sqs:GetQueueAttributes", "sqs:SendMessage"]
        Resource = aws_sqs_queue.document.arn
      },
      {
        Sid      = "CoreBoundaryKeys"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:DescribeKey", "kms:Encrypt", "kms:GenerateDataKey"]
        Resource = [for name, key in aws_kms_key.boundary : key.arn if endswith(name, "object") || name == "queue"]
      },
    ]
  })
}

resource "aws_iam_role_policy" "worker_task" {
  name = "worker-exact-document-boundary"
  role = aws_iam_role.worker_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadOnlySourceZones"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion"]
        Resource = [
          "${aws_s3_bucket.zone["untrusted"].arn}/*",
          "${aws_s3_bucket.zone["approved"].arn}/*",
        ]
      },
      {
        Sid      = "WriteSafePreviewOnly"
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.zone["preview"].arn}/*"
      },
      {
        Sid    = "ConsumeDocumentQueueOnly"
        Effect = "Allow"
        Action = [
          "sqs:ChangeMessageVisibility",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ReceiveMessage",
        ]
        Resource = aws_sqs_queue.document.arn
      },
      {
        Sid    = "WorkerReadBoundaryKeys"
        Effect = "Allow"
        Action = ["kms:Decrypt", "kms:DescribeKey"]
        Resource = [
          aws_kms_key.boundary["untrusted-object"].arn,
          aws_kms_key.boundary["approved-object"].arn,
          aws_kms_key.boundary["queue"].arn,
        ]
      },
      {
        Sid      = "WorkerWritePreviewKeyOnly"
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:GenerateDataKey"]
        Resource = aws_kms_key.boundary["preview-object"].arn
      },
    ]
  })
}

mock_provider "aws" {}

override_data {
  target = data.aws_caller_identity.current
  values = {
    account_id = "111111111111"
  }
}

override_data {
  target = data.aws_region.current
  values = {
    region = "ap-northeast-2"
  }
}

run "synthetic_staging_boundaries_fail_closed" {
  command = plan

  variables {
    aws_account_id           = "111111111111"
    github_oidc_provider_arn = "arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com"
  }

  assert {
    condition     = toset(keys(aws_ecr_repository.runtime)) == toset(["web", "core-api", "document-worker"])
    error_message = "Exactly the three approved runtime repositories must exist."
  }

  assert {
    condition = alltrue([
      for repository in aws_ecr_repository.runtime :
      repository.image_tag_mutability == "IMMUTABLE" &&
      repository.force_delete == false &&
      repository.image_scanning_configuration[0].scan_on_push == true &&
      repository.encryption_configuration[0].encryption_type == "KMS"
    ])
    error_message = "Every runtime repository must be immutable, retained, scanned, and KMS encrypted."
  }

  assert {
    condition     = toset(keys(aws_s3_bucket.zone)) == toset(["untrusted", "approved", "preview"])
    error_message = "The three document trust zones must be separate buckets."
  }

  assert {
    condition = alltrue([
      for zone in aws_s3_bucket_public_access_block.zone :
      zone.block_public_acls && zone.block_public_policy && zone.ignore_public_acls && zone.restrict_public_buckets
    ])
    error_message = "Every trust-zone bucket must reject all public access modes."
  }

  assert {
    condition = alltrue([
      for policy in aws_s3_bucket_policy.zone :
      strcontains(policy.policy, "DenyMissingObjectEncryptionKey") &&
      strcontains(policy.policy, "DenyWrongObjectEncryptionKey") &&
      strcontains(policy.policy, "DenyInsecureTransport")
    ])
    error_message = "Each zone must deny plaintext transport, missing KMS headers, and the wrong KMS key."
  }

  assert {
    condition = alltrue([
      for key in aws_kms_key.boundary : key.enable_key_rotation && key.multi_region == false && key.deletion_window_in_days == 30
    ])
    error_message = "Every purpose-specific key must rotate, remain regional, and resist immediate deletion."
  }

  assert {
    condition     = strcontains(aws_kms_key.boundary["logs"].policy, "kms:EncryptionContext:aws:logs:arn")
    error_message = "The log key must be scoped to this account's runtime log-group encryption context."
  }

  assert {
    condition     = aws_sqs_queue.document.kms_master_key_id == aws_kms_key.boundary["queue"].arn
    error_message = "The document queue must use the queue-specific KMS key."
  }

  assert {
    condition     = jsondecode(aws_sqs_queue.document.redrive_policy).deadLetterTargetArn == aws_sqs_queue.dead_letter.arn
    error_message = "The document queue must fail into its exact DLQ."
  }

  assert {
    condition     = strcontains(aws_iam_role.registry_publisher.assume_role_policy, "repo:ji-hun-git/dna:environment:synthetic-staging-registry")
    error_message = "The registry role must trust only the protected repository environment subject."
  }

  assert {
    condition     = !strcontains(aws_iam_role_policy.registry_publisher.policy, "ecs:UpdateService") && !strcontains(aws_iam_role_policy.registry_publisher.policy, "iam:") && !strcontains(aws_iam_role_policy.registry_publisher.policy, "s3:")
    error_message = "The registry publisher must not deploy workloads or access data."
  }

  assert {
    condition = length(one([
      for statement in jsondecode(aws_iam_role_policy.worker_task.policy).Statement : statement
      if statement.Sid == "ReadOnlySourceZones"
      ]).Resource) == 2 && toset(one([
      for statement in jsondecode(aws_iam_role_policy.worker_task.policy).Statement : statement
      if statement.Sid == "ReadOnlySourceZones"
      ]).Action) == toset(["s3:GetObject", "s3:GetObjectVersion"]) && one([
      for statement in jsondecode(aws_iam_role_policy.worker_task.policy).Statement : statement
      if statement.Sid == "WriteSafePreviewOnly"
      ]).Action == "s3:PutObject" && one([
      for statement in jsondecode(aws_iam_role_policy.worker_task.policy).Statement : statement
      if statement.Sid == "WriteSafePreviewOnly"
    ]).Resource == "${aws_s3_bucket.zone["preview"].arn}/*"
    error_message = "The worker must not receive read permission to browser-safe previews."
  }

  assert {
    condition = one([
      for statement in jsondecode(aws_iam_role_policy.worker_task.policy).Statement : statement
      if statement.Sid == "WorkerWritePreviewKeyOnly"
      ]).Resource == aws_kms_key.boundary["preview-object"].arn && toset(one([
        for statement in jsondecode(aws_iam_role_policy.worker_task.policy).Statement : statement
        if statement.Sid == "WorkerWritePreviewKeyOnly"
    ]).Action) == toset(["kms:Encrypt", "kms:GenerateDataKey"])
    error_message = "The worker may generate data keys only for the safe-preview key."
  }

  assert {
    condition     = length(aws_secretsmanager_secret.runtime) == 3
    error_message = "Only empty database, worker, and audit secret containers are allowed."
  }
}

run "rejects_a_non_seoul_region" {
  command = plan

  variables {
    aws_account_id           = "111111111111"
    aws_region               = "us-east-1"
    github_oidc_provider_arn = "arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com"
  }

  expect_failures = [var.aws_region]
}

locals {
  common_tags = merge(
    {
      Application     = "genome-companion-korea"
      Environment     = "synthetic-staging"
      ManagedBy       = "OpenTofu"
      DataClass       = "synthetic-only"
      PhiPermitted    = "false"
      ProviderEnabled = "false"
    },
    var.tags,
  )

  runtime_names = toset([
    "web",
    "core-api",
    "document-worker",
  ])

  storage_zones = {
    untrusted = {
      expiration_days = 1
      kms_purpose     = "untrusted-object"
    }
    approved = {
      expiration_days = 7
      kms_purpose     = "approved-object"
    }
    preview = {
      expiration_days = 7
      kms_purpose     = "preview-object"
    }
  }

  kms_purposes = toset([
    "registry",
    "untrusted-object",
    "approved-object",
    "preview-object",
    "queue",
    "logs",
    "secrets",
  ])

  oidc_subject = "repo:${var.github_repository}:environment:${var.registry_environment_name}"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

check "dedicated_nonproduction_account" {
  assert {
    condition     = data.aws_caller_identity.current.account_id == var.aws_account_id
    error_message = "the AWS provider must target the declared dedicated non-production account."
  }
}

check "seoul_provider_region" {
  assert {
    condition     = data.aws_region.current.region == var.aws_region
    error_message = "the AWS provider itself must target ap-northeast-2."
  }
}

check "oidc_provider_account" {
  assert {
    condition     = strcontains(var.github_oidc_provider_arn, "::${var.aws_account_id}:")
    error_message = "the GitHub OIDC provider must belong to the declared non-production account."
  }
}

mock_provider "aws" {}

override_resource {
  target = aws_organizations_organization.this
  values = {
    roots = [
      {
        arn          = "arn:aws:organizations::111111111111:root/o-example/r-example"
        id           = "r-example"
        name         = "Root"
        policy_types = []
      },
    ]
  }
}

override_resource {
  target = aws_organizations_organizational_unit.security
  values = {
    id = "ou-exam-11111111"
  }
}

override_resource {
  target = aws_organizations_organizational_unit.workloads
  values = {
    id = "ou-exam-22222222"
  }
}

override_resource {
  target = aws_organizations_organizational_unit.research
  values = {
    id = "ou-exam-33333333"
  }
}

run "organization_has_exact_account_boundaries" {
  command = plan

  variables {
    management_account_id = "111111111111"
    account_emails = {
      security        = "aws-security@example.invalid"
      log_archive     = "aws-log-archive@example.invalid"
      shared_services = "aws-shared@example.invalid"
      nonprod         = "aws-nonprod@example.invalid"
      prod_kr         = "aws-prod-kr@example.invalid"
      research        = "aws-research@example.invalid"
      backup          = "aws-backup@example.invalid"
    }
  }

  assert {
    condition     = length(aws_organizations_account.member) == 7
    error_message = "Exactly seven member accounts must accompany the existing management account."
  }

  assert {
    condition = toset([
      aws_organizations_organizational_unit.security.name,
      aws_organizations_organizational_unit.workloads.name,
      aws_organizations_organizational_unit.research.name,
    ]) == toset(["Security", "Workloads", "Research"])
    error_message = "The organization must expose exactly the Security, Workloads, and Research boundaries."
  }

  assert {
    condition     = strcontains(aws_organizations_policy.region_lock.content, "ap-northeast-2")
    error_message = "The workload region lock must allow Seoul."
  }

  assert {
    condition = toset(jsondecode(aws_organizations_policy.region_lock.content).Statement[0].NotAction) == toset([
      "aws-portal:*",
      "billing:*",
      "budgets:*",
      "ce:*",
      "cloudfront:*",
      "cur:*",
      "iam:*",
      "organizations:*",
      "route53:*",
      "route53domains:*",
      "support:*",
    ])
    error_message = "The region lock global-service exemption must remain closed and reviewed."
  }

  assert {
    condition     = strcontains(aws_organizations_policy.security_tamper_guard.content, "cloudtrail:StopLogging")
    error_message = "Member accounts must not disable organization audit logging."
  }


  assert {
    condition = alltrue([
      for action in [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "config:StopConfigurationRecorder",
        "guardduty:DeleteDetector",
        "securityhub:DisableSecurityHub",
        "kms:ScheduleKeyDeletion",
        "backup:DeleteBackupVault",
        "s3:DeleteAccountPublicAccessBlock",
        ] : contains(flatten([
          for statement in jsondecode(aws_organizations_policy.security_tamper_guard.content).Statement : statement.Action
      ]), action)
    ])
    error_message = "Every approved audit, security, KMS, backup, and public-access tamper action must be denied."
  }

  assert {
    condition     = toset(keys(aws_organizations_policy_attachment.region_lock)) == toset(["workloads", "research"])
    error_message = "The region lock must attach only to Workloads and Research, never the management account."
  }

  assert {
    condition     = aws_organizations_policy_attachment.security_tamper_guard.target_id == aws_organizations_organizational_unit.security.id
    error_message = "The security tamper guard must protect the Security OU."
  }
}

run "rejects_an_incomplete_account_boundary" {
  command = plan

  variables {
    management_account_id = "111111111111"
    account_emails = {
      security        = "aws-security@example.invalid"
      log_archive     = "aws-log-archive@example.invalid"
      shared_services = "aws-shared@example.invalid"
      nonprod         = "aws-nonprod@example.invalid"
      prod_kr         = "aws-prod-kr@example.invalid"
      research        = "aws-research@example.invalid"
    }
  }

  expect_failures = [var.account_emails]
}

run "rejects_duplicate_account_emails" {
  command = plan

  variables {
    management_account_id = "111111111111"
    account_emails = {
      security        = "same@example.invalid"
      log_archive     = "same@example.invalid"
      shared_services = "aws-shared@example.invalid"
      nonprod         = "aws-nonprod@example.invalid"
      prod_kr         = "aws-prod-kr@example.invalid"
      research        = "aws-research@example.invalid"
      backup          = "aws-backup@example.invalid"
    }
  }

  expect_failures = [var.account_emails]
}

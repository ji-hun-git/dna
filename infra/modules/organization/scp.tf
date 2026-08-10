locals {
  region_lock_policy = {
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyOutsideSeoulExceptRequiredGlobalServices"
        Effect = "Deny"
        NotAction = [
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
        ]
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:RequestedRegion" = "ap-northeast-2"
          }
        }
      },
    ]
  }

  security_tamper_guard_policy = {
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyOrganizationAuditTampering"
        Effect = "Deny"
        Action = [
          "cloudtrail:DeleteTrail",
          "cloudtrail:StopLogging",
          "config:DeleteConfigurationRecorder",
          "config:StopConfigurationRecorder",
          "guardduty:DeleteDetector",
          "guardduty:DisassociateFromAdministratorAccount",
          "guardduty:DisassociateMembers",
          "securityhub:DisableSecurityHub",
          "securityhub:DisassociateFromAdministratorAccount",
        ]
        Resource = "*"
      },
      {
        Sid    = "DenyEncryptionAndBackupTampering"
        Effect = "Deny"
        Action = [
          "backup:DeleteBackupVault",
          "backup:DeleteBackupVaultAccessPolicy",
          "backup:DeleteRecoveryPoint",
          "kms:DisableKey",
          "kms:ScheduleKeyDeletion",
          "s3:DeleteAccountPublicAccessBlock",
        ]
        Resource = "*"
      },
    ]
  }
}

resource "aws_organizations_policy" "region_lock" {
  name        = "gc-workload-region-lock"
  description = "Deny workload operations outside Seoul while retaining only required global control planes."
  type        = "SERVICE_CONTROL_POLICY"
  content     = jsonencode(local.region_lock_policy)
}

resource "aws_organizations_policy" "security_tamper_guard" {
  name        = "gc-security-tamper-guard"
  description = "Deny member-account attempts to disable audit, security, encryption, backup, or public-access controls."
  type        = "SERVICE_CONTROL_POLICY"
  content     = jsonencode(local.security_tamper_guard_policy)
}

terraform {
  required_version = "= 1.10.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.10.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

module "organization" {
  source = "../../modules/organization"

  management_account_id = var.management_account_id
  account_emails        = var.account_emails
}

output "account_ids" {
  description = "The existing management account and seven managed member account IDs."
  value       = module.organization.account_ids
  sensitive   = true
}

output "organizational_unit_ids" {
  description = "The exact organization boundary IDs."
  value       = module.organization.organizational_unit_ids
}

output "region_lock_policy_id" {
  description = "The Seoul workload-region SCP ID."
  value       = module.organization.region_lock_policy_id
}

output "security_tamper_guard_policy_id" {
  description = "The Security OU tamper-protection SCP ID."
  value       = module.organization.security_tamper_guard_policy_id
}

output "account_ids" {
  description = "The existing management account and seven managed member account IDs."
  value = merge(
    { management = var.management_account_id },
    { for key, account in aws_organizations_account.member : key => account.id },
  )
  sensitive = true
}

output "organizational_unit_ids" {
  description = "The exact organization boundary IDs."
  value = {
    security  = aws_organizations_organizational_unit.security.id
    workloads = aws_organizations_organizational_unit.workloads.id
    research  = aws_organizations_organizational_unit.research.id
  }
}

output "region_lock_policy_id" {
  description = "The Seoul workload-region SCP ID."
  value       = aws_organizations_policy.region_lock.id
}

output "security_tamper_guard_policy_id" {
  description = "The Security OU tamper-protection SCP ID."
  value       = aws_organizations_policy.security_tamper_guard.id
}

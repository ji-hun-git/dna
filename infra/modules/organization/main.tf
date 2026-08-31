terraform {
  required_version = "= 1.10.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.10.0"
    }
  }
}

locals {
  account_names = {
    security        = "gc-security"
    log_archive     = "gc-log-archive"
    shared_services = "gc-shared-services"
    nonprod         = "gc-nonprod"
    prod_kr         = "gc-prod-kr"
    research        = "gc-research"
    backup          = "gc-backup"
  }

  account_organizational_units = {
    security        = "security"
    log_archive     = "security"
    backup          = "security"
    shared_services = "workloads"
    nonprod         = "workloads"
    prod_kr         = "workloads"
    research        = "research"
  }
}

resource "aws_organizations_organization" "this" {
  enabled_policy_types = ["SERVICE_CONTROL_POLICY"]
  feature_set          = "ALL"
}

resource "aws_organizations_organizational_unit" "security" {
  name      = "Security"
  parent_id = aws_organizations_organization.this.roots[0].id
}

resource "aws_organizations_organizational_unit" "workloads" {
  name      = "Workloads"
  parent_id = aws_organizations_organization.this.roots[0].id
}

resource "aws_organizations_organizational_unit" "research" {
  name      = "Research"
  parent_id = aws_organizations_organization.this.roots[0].id
}

resource "aws_organizations_account" "member" {
  for_each = var.account_emails

  name  = local.account_names[each.key]
  email = each.value
  parent_id = {
    security  = aws_organizations_organizational_unit.security.id
    workloads = aws_organizations_organizational_unit.workloads.id
    research  = aws_organizations_organizational_unit.research.id
  }[local.account_organizational_units[each.key]]

  close_on_deletion = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_organizations_policy_attachment" "region_lock" {
  for_each = {
    workloads = aws_organizations_organizational_unit.workloads.id
    research  = aws_organizations_organizational_unit.research.id
  }

  policy_id = aws_organizations_policy.region_lock.id
  target_id = each.value
}

resource "aws_organizations_policy_attachment" "security_tamper_guard" {
  policy_id = aws_organizations_policy.security_tamper_guard.id
  target_id = aws_organizations_organizational_unit.security.id
}

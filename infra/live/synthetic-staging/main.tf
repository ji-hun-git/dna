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

  default_tags {
    tags = {
      Application  = "genome-companion-korea"
      Environment  = "synthetic-staging"
      DataClass    = "synthetic-only"
      PhiPermitted = "false"
    }
  }
}

module "synthetic_staging" {
  source = "../../modules/synthetic-staging"

  aws_account_id           = var.aws_account_id
  github_oidc_provider_arn = var.github_oidc_provider_arn
}

output "runtime_repository_urls" {
  value = module.synthetic_staging.runtime_repository_urls
}

output "registry_publisher_role_arn" {
  value = module.synthetic_staging.registry_publisher_role_arn
}

output "storage_zone_buckets" {
  value = module.synthetic_staging.storage_zone_buckets
}

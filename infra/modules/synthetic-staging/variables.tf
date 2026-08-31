terraform {
  required_version = "= 1.10.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.10.0"
    }
  }
}

variable "aws_account_id" {
  description = "The dedicated non-production AWS account that may contain synthetic data only."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be exactly 12 decimal digits."
  }
}

variable "aws_region" {
  description = "The only region permitted for this Korea staging boundary."
  type        = string
  default     = "ap-northeast-2"

  validation {
    condition     = var.aws_region == "ap-northeast-2"
    error_message = "synthetic staging must remain in AWS Seoul (ap-northeast-2)."
  }
}

variable "project_name" {
  description = "Lowercase prefix used for staging resources."
  type        = string
  default     = "gc-synthetic-staging"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.project_name))
    error_message = "project_name must be 3-31 lowercase letters, digits, or hyphens."
  }
}

variable "github_repository" {
  description = "The sole GitHub repository allowed to request the registry publisher role."
  type        = string
  default     = "ji-hun-git/dna"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must be an exact owner/repository pair."
  }
}

variable "github_oidc_provider_arn" {
  description = "Pre-created GitHub Actions OIDC provider ARN in the non-production AWS account."
  type        = string

  validation {
    condition = can(regex(
      "^arn:aws:iam::[0-9]{12}:oidc-provider/token[.]actions[.]githubusercontent[.]com$",
      var.github_oidc_provider_arn,
    ))
    error_message = "github_oidc_provider_arn must name the exact GitHub Actions token provider."
  }
}

variable "registry_environment_name" {
  description = "Protected GitHub environment encoded into the OIDC subject."
  type        = string
  default     = "synthetic-staging-registry"

  validation {
    condition     = var.registry_environment_name == "synthetic-staging-registry"
    error_message = "the registry environment name is a fixed security boundary."
  }
}

variable "tags" {
  description = "Additional non-sensitive resource tags."
  type        = map(string)
  default     = {}
}

variable "aws_account_id" {
  description = "Dedicated gc-nonprod account ID."
  type        = string
}

variable "github_oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN in gc-nonprod."
  type        = string
}

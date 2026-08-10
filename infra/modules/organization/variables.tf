variable "management_account_id" {
  description = "The existing AWS Organizations management account ID."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.management_account_id))
    error_message = "management_account_id must be exactly 12 decimal digits."
  }
}

variable "account_emails" {
  description = "Unique root email addresses for the seven member accounts."
  type        = map(string)

  validation {
    condition = toset(keys(var.account_emails)) == toset(
      [
        "security",
        "log_archive",
        "shared_services",
        "nonprod",
        "prod_kr",
        "research",
        "backup",
      ],
    )
    error_message = "account_emails must contain exactly security, log_archive, shared_services, nonprod, prod_kr, research, and backup."
  }

  validation {
    condition = alltrue([
      for email in values(var.account_emails) : can(regex("^[^@[:space:]]+@[^@[:space:]]+$", email))
    ]) && length(toset(values(var.account_emails))) == 7
    error_message = "Every member account email must be non-empty, email-shaped, and unique."
  }
}

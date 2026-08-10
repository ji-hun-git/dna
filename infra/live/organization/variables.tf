variable "management_account_id" {
  description = "The existing AWS Organizations management account ID."
  type        = string
}

variable "account_emails" {
  description = "Unique root email addresses for the seven member accounts."
  type        = map(string)
  sensitive   = true
}

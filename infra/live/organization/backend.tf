terraform {
  backend "s3" {
    encrypt      = true
    use_lockfile = true
    key          = "organization/terraform.tfstate"
    region       = "ap-northeast-2"
  }
}

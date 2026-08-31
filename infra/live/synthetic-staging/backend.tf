terraform {
  backend "s3" {
    encrypt      = true
    use_lockfile = true
    key          = "synthetic-staging/terraform.tfstate"
    region       = "ap-northeast-2"
  }
}

resource "aws_s3_bucket" "zone" {
  for_each = local.storage_zones

  bucket        = "${var.project_name}-${each.key}-${var.aws_account_id}"
  force_destroy = false

  tags = merge(local.common_tags, { TrustZone = each.key })
}

resource "aws_s3_bucket_public_access_block" "zone" {
  for_each = aws_s3_bucket.zone

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "zone" {
  for_each = aws_s3_bucket.zone

  bucket = each.value.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "zone" {
  for_each = aws_s3_bucket.zone

  bucket = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "zone" {
  for_each = local.storage_zones

  bucket = aws_s3_bucket.zone[each.key].id
  rule {
    bucket_key_enabled = true
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.boundary[each.value.kms_purpose].arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "zone" {
  for_each = local.storage_zones

  bucket = aws_s3_bucket.zone[each.key].id
  rule {
    id     = "bounded-synthetic-retention"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }

    expiration {
      days = each.value.expiration_days
    }

    noncurrent_version_expiration {
      noncurrent_days = each.value.expiration_days
    }
  }
}

resource "aws_s3_bucket_policy" "zone" {
  for_each = local.storage_zones

  bucket = aws_s3_bucket.zone[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.zone[each.key].arn,
          "${aws_s3_bucket.zone[each.key].arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
      {
        Sid       = "DenyMissingObjectEncryptionKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.zone[each.key].arn}/*"
        Condition = {
          Null = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = "true"
          }
        }
      },
      {
        Sid       = "DenyWrongObjectEncryptionKey"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.zone[each.key].arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = aws_kms_key.boundary[each.value.kms_purpose].arn
          }
        }
      },
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.zone,
    aws_s3_bucket_server_side_encryption_configuration.zone,
  ]
}

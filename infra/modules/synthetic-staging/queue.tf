resource "aws_sqs_queue" "dead_letter" {
  name                              = "${var.project_name}-document-dead-letter"
  message_retention_seconds         = 1209600
  kms_master_key_id                 = aws_kms_key.boundary["queue"].arn
  kms_data_key_reuse_period_seconds = 300

  tags = merge(local.common_tags, { QueueRole = "dead-letter" })
}

resource "aws_sqs_queue" "document" {
  name                              = "${var.project_name}-document"
  delay_seconds                     = 0
  max_message_size                  = 65536
  message_retention_seconds         = 345600
  receive_wait_time_seconds         = 20
  visibility_timeout_seconds        = 180
  kms_master_key_id                 = aws_kms_key.boundary["queue"].arn
  kms_data_key_reuse_period_seconds = 300
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, { QueueRole = "document-work" })
}

resource "aws_sqs_queue_redrive_allow_policy" "dead_letter" {
  queue_url = aws_sqs_queue.dead_letter.id
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.document.arn]
  })
}

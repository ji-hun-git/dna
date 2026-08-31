resource "aws_cloudwatch_log_group" "runtime" {
  for_each = local.runtime_names

  name              = "/${var.project_name}/${each.key}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.boundary["logs"].arn

  tags = merge(local.common_tags, { Runtime = each.key, PayloadLogging = "prohibited" })
}

resource "aws_cloudwatch_metric_alarm" "queue_oldest" {
  alarm_name          = "${var.project_name}-document-queue-oldest"
  alarm_description   = "Synthetic queue age exceeded the bounded staging target; no message body is emitted."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 300
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.document.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dead_letter_visible" {
  alarm_name          = "${var.project_name}-document-dlq-visible"
  alarm_description   = "At least one synthetic document job reached the DLQ; no message body is emitted."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.dead_letter.name
  }

  tags = local.common_tags
}

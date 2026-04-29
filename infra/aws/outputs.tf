output "alb_dns" {
  description = "Public ALB DNS — citizen + cmcc traffic enters here"
  value       = aws_lb.main.dns_name
}

output "mqtt_dns" {
  description = "Public NLB DNS for MQTT (only set when enable_mqtt = true)"
  value       = var.enable_mqtt ? aws_lb.mqtt[0].dns_name : null
}

output "ecr_web_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecr_cmcc_url" {
  value = aws_ecr_repository.cmcc.repository_url
}

output "rds_endpoint" {
  description = "Postgres endpoint (private — only ECS reaches it)"
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "secrets" {
  description = "Secrets Manager ARNs in use by the ECS tasks"
  value = {
    jwt    = aws_secretsmanager_secret.jwt.arn
    db     = aws_secretsmanager_secret.db.arn
    openai = try(aws_secretsmanager_secret.openai[0].arn, null)
  }
}

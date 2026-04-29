resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.project_name}/${var.environment}/jwt-secret"
  description             = "Hearthly JWT signing secret"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

resource "aws_secretsmanager_secret" "openai" {
  count                   = var.openai_api_key == "" ? 0 : 1
  name                    = "${var.project_name}/${var.environment}/openai-api-key"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "openai" {
  count         = var.openai_api_key == "" ? 0 : 1
  secret_id     = aws_secretsmanager_secret.openai[0].id
  secret_string = var.openai_api_key
}

resource "aws_secretsmanager_secret" "supabase_url" {
  count                   = var.supabase_url == "" ? 0 : 1
  name                    = "${var.project_name}/${var.environment}/supabase-url"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_url" {
  count         = var.supabase_url == "" ? 0 : 1
  secret_id     = aws_secretsmanager_secret.supabase_url[0].id
  secret_string = var.supabase_url
}

resource "aws_secretsmanager_secret" "supabase_key" {
  count                   = var.supabase_service_role_key == "" ? 0 : 1
  name                    = "${var.project_name}/${var.environment}/supabase-service-role-key"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "supabase_key" {
  count         = var.supabase_service_role_key == "" ? 0 : 1
  secret_id     = aws_secretsmanager_secret.supabase_key[0].id
  secret_string = var.supabase_service_role_key
}


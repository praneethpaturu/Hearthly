resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.project_name}/${var.environment}/db-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = random_password.db.result
}

resource "aws_db_instance" "main" {
  identifier              = "${var.project_name}-${var.environment}"
  engine                  = "postgres"
  engine_version          = "16.4"
  instance_class          = var.rds_instance_class
  allocated_storage       = var.rds_storage_gb
  max_allocated_storage   = var.rds_storage_gb * 4
  storage_encrypted       = true
  db_name                 = "hearthly"
  username                = "hearthly"
  password                = random_password.db.result
  multi_az                = var.rds_multi_az
  publicly_accessible     = false
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  backup_retention_period = 7
  skip_final_snapshot     = var.environment != "prod"
  deletion_protection     = var.environment == "prod"
  apply_immediately       = var.environment != "prod"
}

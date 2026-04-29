resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.project_name}/web"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "cmcc" {
  name              = "/ecs/${var.project_name}/cmcc"
  retention_in_days = 30
}

# IAM ----------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.project_name}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read our secrets.
data "aws_iam_policy_document" "secrets_read" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = compact([
      aws_secretsmanager_secret.jwt.arn,
      aws_secretsmanager_secret.db.arn,
      length(aws_secretsmanager_secret.openai) > 0 ? aws_secretsmanager_secret.openai[0].arn : "",
      length(aws_secretsmanager_secret.supabase_url) > 0 ? aws_secretsmanager_secret.supabase_url[0].arn : "",
      length(aws_secretsmanager_secret.supabase_key) > 0 ? aws_secretsmanager_secret.supabase_key[0].arn : "",
    ])
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  name   = "${var.project_name}-secrets-read"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.secrets_read.json
}

# Task definitions ---------------------------------------------------------

locals {
  base_secrets = [
    { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
  ]
  optional_secrets = concat(
    var.openai_api_key == "" ? [] : [{ name = "OPENAI_API_KEY", valueFrom = aws_secretsmanager_secret.openai[0].arn }],
    var.supabase_url == "" ? [] : [{ name = "SUPABASE_URL", valueFrom = aws_secretsmanager_secret.supabase_url[0].arn }],
    var.supabase_service_role_key == "" ? [] : [{ name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = aws_secretsmanager_secret.supabase_key[0].arn }],
  )
  task_secrets = concat(local.base_secrets, local.optional_secrets)
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project_name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.web.repository_url}:latest"
    essential = true
    portMappings = [
      { containerPort = 3030, protocol = "tcp" },
      { containerPort = 1883, protocol = "tcp" },
    ]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3030" },
      { name = "MQTT_PORT", value = "1883" },
    ]
    secrets = local.task_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.web.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "web"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "cmcc" {
  family                   = "${var.project_name}-cmcc"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "cmcc"
    image     = "${aws_ecr_repository.cmcc.repository_url}:latest"
    essential = true
    portMappings = [
      { containerPort = 4040, protocol = "tcp" },
    ]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "4040" },
    ]
    secrets = local.task_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.cmcc.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "cmcc"
      }
    }
  }])
}

# Services -----------------------------------------------------------------

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3030
  }

  dynamic "load_balancer" {
    for_each = var.enable_mqtt ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.mqtt[0].arn
      container_name   = "web"
      container_port   = 1883
    }
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_ecs_service" "cmcc" {
  name            = "cmcc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.cmcc.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.cmcc.arn
    container_name   = "cmcc"
    container_port   = 4040
  }

  depends_on = [aws_lb_listener.http]
}

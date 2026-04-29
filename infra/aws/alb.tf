resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "web" {
  name        = "${var.project_name}-web"
  port        = 3030
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/api/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
}

resource "aws_lb_target_group" "cmcc" {
  name        = "${var.project_name}-cmcc"
  port        = 4040
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/api/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# Route /cmcc/* and host-header `cmcc.<domain>` to the CMCC service.
resource "aws_lb_listener_rule" "cmcc_path" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100
  condition {
    path_pattern { values = ["/cmcc/*"] }
  }
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cmcc.arn
  }
}

# Optional Network Load Balancer for the MQTT broker (TCP :1883).
resource "aws_lb" "mqtt" {
  count              = var.enable_mqtt ? 1 : 0
  name               = "${var.project_name}-mqtt"
  internal           = false
  load_balancer_type = "network"
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "mqtt" {
  count       = var.enable_mqtt ? 1 : 0
  name        = "${var.project_name}-mqtt"
  port        = 1883
  protocol    = "TCP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    protocol = "TCP"
    interval = 30
  }
}

resource "aws_lb_listener" "mqtt" {
  count             = var.enable_mqtt ? 1 : 0
  load_balancer_arn = aws_lb.mqtt[0].arn
  port              = 1883
  protocol          = "TCP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.mqtt[0].arn
  }
}

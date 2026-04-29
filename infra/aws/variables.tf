variable "region" {
  description = "AWS region. Use ap-south-1 for India data residency."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "deployment environment label (staging, prod)"
  type        = string
  default     = "staging"
}

variable "owner" {
  description = "team / individual owning this stack"
  type        = string
  default     = "hearthly"
}

variable "project_name" {
  description = "name prefix for all resources"
  type        = string
  default     = "hearthly"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "az_count" {
  description = "number of AZs to spread subnets across"
  type        = number
  default     = 2
}

variable "container_cpu" {
  description = "Fargate task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "ECS desired task count per service"
  type        = number
  default     = 1
}

variable "rds_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "rds_storage_gb" {
  type    = number
  default = 20
}

variable "rds_multi_az" {
  type    = bool
  default = false
}

variable "domain_zone_id" {
  description = "Route53 zone ID. Empty disables Route53 + ACM."
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Apex / subdomain to point at the ALB. Required if domain_zone_id is set."
  type        = string
  default     = ""
}

variable "enable_mqtt" {
  description = "Provision NLB :1883 for MQTT broker traffic."
  type        = bool
  default     = false
}

variable "openai_api_key" {
  description = "OpenAI API key. Stored in Secrets Manager."
  type        = string
  sensitive   = true
  default     = ""
}

variable "supabase_url" {
  description = "Supabase project URL (optional — leave empty to use RDS only)."
  type        = string
  default     = ""
}

variable "supabase_service_role_key" {
  description = "Supabase service role key. Stored in Secrets Manager."
  type        = string
  sensitive   = true
  default     = ""
}

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # Recommended: switch to S3 + DynamoDB backend before any non-toy use.
  # backend "s3" {
  #   bucket         = "hearthly-tfstate-ap-south-1"
  #   key            = "envs/staging/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "hearthly-tfstate-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "hearthly"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state (recommended for team/production use):
  # 1. Create an S3 bucket and DynamoDB table for state locking:
  #    aws s3api create-bucket --bucket <YOUR-STATE-BUCKET> --region <REGION>
  #    aws dynamodb create-table --table-name terraform-lock \
  #      --attribute-definitions AttributeName=LockID,AttributeType=S \
  #      --key-schema AttributeName=LockID,KeyType=HASH \
  #      --billing-mode PAY_PER_REQUEST
  # 2. Uncomment and configure the backend block below:
  # backend "s3" {
  #   bucket         = "<YOUR-STATE-BUCKET>"
  #   key            = "terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   dynamodb_table = "terraform-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "Terraform"
    }
  }
}

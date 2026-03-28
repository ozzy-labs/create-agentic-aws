variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "{{projectName}}"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

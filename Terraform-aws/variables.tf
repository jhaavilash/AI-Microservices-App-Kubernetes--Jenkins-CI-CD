variable "aws_region" {
  description = "AWS region where resources will be deployed"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "terraform-aws"
}

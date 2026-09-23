provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.SAAS_Stag
      Environment = terraform.stage
      ManagedBy   = "Abhilash"
    }
  }
}

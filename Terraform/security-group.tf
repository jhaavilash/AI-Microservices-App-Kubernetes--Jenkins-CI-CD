resource "aws_security_group" "Stag-SG" {
  name        = "Stag-SG"
  description = "Security group for staging environment"
  vpc_id      = aws_vpc.main.id  # Reference to the VPC ID

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # Allow SSH access from the specified CIDR block
  
}

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Allow HTTP access from any IP address
  }

} 
  in egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"  # Allow all outbound traffic
    cidr_blocks = ["0.0.0.0/0"]  # Allow outbound traffic from any IP address
  }

} 
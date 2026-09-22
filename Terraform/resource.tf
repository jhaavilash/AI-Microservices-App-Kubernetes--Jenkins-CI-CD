# Aws Resource

resource "aws_instance" "Test" {

  ami = abs(lookup(data.aws_ami.ubuntu, "id", "ami-0c55b159cbfafe1f0"))  # Specify the AMI ID for the Ubuntu image
  instance_type = t2.micro  # Specify the instance type
  security_groups = [aws_security_group.Test.id]

}

###############################################################################
# Hospital CRM — foundational IaC
#   - VPC + subnets
#   - EKS cluster (Kubernetes control plane for microservices)
#   - RDS Postgres (primary OLTP store, PHI-bearing)
#   - ElastiCache Redis (nonce store / session cache)
#   - KMS key for at-rest encryption (DB + secrets)
#
# This is foundational — production deployments should layer in:
#   * VPC flow logs + GuardDuty
#   * RDS read replicas + automated cross-region snapshots
#   * Secrets Manager rotation policies
#   * IRSA (IAM Roles for Service Accounts) per microservice
###############################################################################

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws        = { source = "hashicorp/aws",        version = "~> 5.40" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.27" }
    random     = { source = "hashicorp/random",     version = "~> 3.6"  }
  }

  backend "s3" {
    bucket         = "hospital-crm-tfstate"
    key            = "core/main.tfstate"
    region         = "us-east-1"
    dynamodb_table = "hospital-crm-tflock"
    encrypt        = true
  }
}

# --- Inputs -----------------------------------------------------------------
variable "region"        { type = string  default = "us-east-1" }
variable "env"           { type = string  default = "prod" }
variable "cluster_name"  { type = string  default = "hospital-crm" }
variable "db_name"       { type = string  default = "hospital_crm" }
variable "db_username"   { type = string  default = "hospital_app" }

provider "aws" { region = var.region }

# --- KMS key for envelope encryption ----------------------------------------
resource "aws_kms_key" "core" {
  description             = "Hospital CRM — encrypts RDS, secrets, EBS"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags = { Env = var.env, App = "hospital-crm" }
}

# --- Networking -------------------------------------------------------------
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.5"

  name                 = "${var.cluster_name}-${var.env}"
  cidr                 = "10.40.0.0/16"
  azs                  = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets      = ["10.40.1.0/24", "10.40.2.0/24", "10.40.3.0/24"]
  public_subnets       = ["10.40.101.0/24", "10.40.102.0/24", "10.40.103.0/24"]
  database_subnets     = ["10.40.201.0/24", "10.40.202.0/24", "10.40.203.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_flow_log      = true
  enable_dns_hostnames = true
}

# --- EKS cluster ------------------------------------------------------------
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.8"

  cluster_name    = "${var.cluster_name}-${var.env}"
  cluster_version = "1.29"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"] # narrow this in prod (corp CIDR)

  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.core.arn
    resources        = ["secrets"]
  }

  eks_managed_node_groups = {
    api = {
      desired_size   = 3
      min_size       = 3
      max_size       = 9
      instance_types = ["t3.large"]
      labels         = { workload = "api" }
    }
    rules_engine = {
      desired_size   = 2
      min_size       = 2
      max_size       = 6
      instance_types = ["c6i.large"]
      labels         = { workload = "rules-engine" }
    }
  }

  tags = { Env = var.env, App = "hospital-crm" }
}

# --- RDS Postgres -----------------------------------------------------------
resource "random_password" "db" {
  length  = 32
  special = true
}

resource "aws_db_subnet_group" "core" {
  name       = "${var.cluster_name}-${var.env}-db"
  subnet_ids = module.vpc.database_subnets
}

resource "aws_security_group" "rds" {
  name   = "${var.cluster_name}-${var.env}-rds"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
    description     = "Postgres from EKS workers only"
  }

  egress {
    from_port = 0; to_port = 0; protocol = "-1"; cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "core" {
  identifier             = "${var.cluster_name}-${var.env}"
  engine                 = "postgres"
  engine_version         = "16.2"
  instance_class         = "db.r6g.large"
  allocated_storage      = 100
  max_allocated_storage  = 1000
  storage_encrypted      = true
  kms_key_id             = aws_kms_key.core.arn
  db_name                = var.db_name
  username               = var.db_username
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.core.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az                    = true
  backup_retention_period     = 30
  deletion_protection         = true
  performance_insights_enabled = true
  iam_database_authentication_enabled = true
  publicly_accessible         = false
  skip_final_snapshot         = false
  final_snapshot_identifier   = "${var.cluster_name}-${var.env}-final"

  tags = { Env = var.env, App = "hospital-crm", Sensitivity = "PHI" }
}

# --- ElastiCache Redis (nonce + rate-limit store) ---------------------------
resource "aws_elasticache_subnet_group" "core" {
  name       = "${var.cluster_name}-${var.env}-redis"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "core" {
  replication_group_id       = "${var.cluster_name}-${var.env}"
  description                = "Hospital CRM nonce/session cache"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.core.name
}

# --- Outputs (consumed by k8s manifests / secrets) --------------------------
output "eks_cluster_name"   { value = module.eks.cluster_name }
output "rds_endpoint"       { value = aws_db_instance.core.endpoint  sensitive = true }
output "rds_password_arn"   { value = aws_kms_key.core.arn }
output "redis_endpoint"     { value = aws_elasticache_replication_group.core.primary_endpoint_address }

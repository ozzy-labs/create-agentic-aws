# AWS Resource Map

Each AWS service preset generates specific infrastructure resources.
This document maps wizard selections to the AWS resources that will be created.

> **Tip:** Run `pnpm create agentic-aws --dry-run` to preview generated files for your specific selection.

## Compute

### Lambda

| CDK | Terraform |
|-----|-----------|
| `lambda_nodejs.NodejsFunction` | `aws_lambda_function` |
| `iam.Role` | `aws_iam_role` |
| — | `aws_iam_role_policy_attachment` (BasicExecution) |

#### Lambda VPC Placement

| CDK | Terraform |
|-----|-----------|
| `ec2.SecurityGroup` | `aws_security_group` |
| — | `aws_iam_role_policy_attachment` (VPCAccess) |

### ECS

| CDK | Terraform |
|-----|-----------|
| `ecs.Cluster` | `aws_ecs_cluster` |
| `ecs_patterns.ApplicationLoadBalancedFargateService` | `aws_ecs_task_definition` |
| — | `aws_ecs_service` |
| — | `aws_lb`, `aws_lb_target_group`, `aws_lb_listener` |
| — | `aws_security_group` x2 (ALB, ECS) |
| — | `aws_iam_role` (execution) |
| — | `aws_cloudwatch_log_group` |

#### ECS Load Balancer

| Option | CDK | Terraform |
|--------|-----|-----------|
| ALB (default) | `ApplicationLoadBalancedFargateService` | `aws_lb` type=application |
| NLB | `NetworkLoadBalancedFargateService` | `aws_lb` type=network |

### EKS

| CDK | Terraform |
|-----|-----------|
| `eks.Cluster` | `aws_eks_cluster` |
| — | `aws_iam_role` x2 (cluster, node) |
| — | `aws_iam_role_policy_attachment` x5 |

#### EKS Mode

| Option | CDK | Terraform |
|--------|-----|-----------|
| Managed Node Group (default) | Default capacity (T3.MEDIUM) | `aws_eks_node_group` |
| Fargate | `Cluster.addFargateProfile` | `aws_eks_fargate_profile` + IAM role |
| Auto Mode | Default (console-level) | Default (console-level) |

### EC2

| CDK | Terraform |
|-----|-----------|
| `ec2.Instance` | `aws_instance` |
| `iam.Role` | `aws_iam_role` |
| `ec2.SecurityGroup` | `aws_security_group` |
| — | `aws_iam_instance_profile` |
| — | `aws_iam_role_policy_attachment` x2 (SSM, CloudWatch) |

## AI

### Bedrock

| CDK | Terraform |
|-----|-----------|
| `iam.ManagedPolicy` | `aws_iam_policy` |

### Bedrock Knowledge Bases

| CDK | Terraform |
|-----|-----------|
| `s3.Bucket` (data source) | `aws_s3_bucket` + encryption + access block |
| `iam.Role` | `aws_iam_role`, `aws_iam_role_policy` |
| `bedrock.CfnKnowledgeBase` | `aws_bedrockagent_knowledge_base` |
| `bedrock.CfnDataSource` | `aws_bedrockagent_data_source` |

### Bedrock Agents

| CDK | Terraform |
|-----|-----------|
| `iam.Role` (agent) | `aws_iam_role` x2 (agent, Lambda) |
| `lambda.Function` (action group) | `aws_lambda_function` (action group) |
| `bedrock.CfnAgent` | `aws_bedrockagent_agent` |
| — | `aws_bedrockagent_agent_action_group` |
| — | `aws_lambda_permission` |

### OpenSearch

#### OpenSearch Mode

| Option | CDK | Terraform |
|--------|-----|-----------|
| Serverless (default) | `CfnSecurityPolicy` x2, `CfnCollection` | `aws_opensearchserverless_security_policy` x2, `aws_opensearchserverless_access_policy`, `aws_opensearchserverless_collection` |
| Managed Cluster | `opensearch.Domain`, `ec2.SecurityGroup` | `aws_opensearch_domain`, `aws_security_group` |

## Data & Storage

### S3

| CDK | Terraform |
|-----|-----------|
| `s3.Bucket` | `aws_s3_bucket` |
| — | `aws_s3_bucket_versioning` |
| — | `aws_s3_bucket_server_side_encryption_configuration` |
| — | `aws_s3_bucket_public_access_block` |

### DynamoDB

| CDK | Terraform |
|-----|-----------|
| `dynamodb.Table` | `aws_dynamodb_table` |

### Aurora

| CDK | Terraform |
|-----|-----------|
| `rds.DatabaseCluster` | `aws_rds_cluster` |
| `rds.ClusterInstance` | `aws_rds_cluster_instance` |
| — | `aws_db_subnet_group` |
| — | `aws_security_group` |

#### Aurora Options

Engine (PostgreSQL / MySQL), Capacity (Serverless v2 / Provisioned)

### RDS

| CDK | Terraform |
|-----|-----------|
| `rds.DatabaseInstance` | `aws_db_instance` |
| — | `aws_db_subnet_group` |
| — | `aws_security_group` |

#### RDS Engine

Engine (PostgreSQL / MySQL)

## Data Pipeline & Analytics

### Kinesis

| CDK | Terraform |
|-----|-----------|
| `kinesis.Stream` | `aws_kinesis_stream` |

### Glue

| CDK | Terraform |
|-----|-----------|
| `glue.CfnDatabase` | `aws_glue_catalog_database` |
| `s3.Bucket` (scripts) | `aws_s3_bucket` (scripts) |
| `iam.Role` | `aws_iam_role`, `aws_iam_role_policy` |
| `glue.CfnJob` | `aws_glue_job` |

### Redshift

#### Redshift Mode

| Option | CDK | Terraform |
|--------|-----|-----------|
| Serverless (default) | `CfnNamespace`, `CfnWorkgroup`, `ec2.SecurityGroup` | `aws_redshiftserverless_namespace`, `aws_redshiftserverless_workgroup`, `aws_security_group` |
| Provisioned | `CfnClusterSubnetGroup`, `CfnCluster` | `aws_redshift_subnet_group`, `aws_redshift_cluster`, `aws_security_group` |

## Application Integration

### SQS

| CDK | Terraform |
|-----|-----------|
| `sqs.Queue` (main) | `aws_sqs_queue` (main) |
| `sqs.Queue` (DLQ) | `aws_sqs_queue` (DLQ) |

### SNS

| CDK | Terraform |
|-----|-----------|
| `sns.Topic` | `aws_sns_topic` |
| — | `aws_sns_topic_policy` |

### EventBridge

| CDK | Terraform |
|-----|-----------|
| `events.EventBus` | `aws_cloudwatch_event_bus` |
| — | `aws_cloudwatch_event_archive` |

### Step Functions

| CDK | Terraform |
|-----|-----------|
| `sfn.StateMachine` | `aws_sfn_state_machine` |
| `logs.LogGroup` | `aws_cloudwatch_log_group` |
| — | `aws_iam_role`, `aws_iam_role_policy` |

## Networking & API

### API Gateway

#### API Gateway Type

| Option | CDK | Terraform |
|--------|-----|-----------|
| HTTP (default) | `apigatewayv2.HttpApi` | `aws_apigatewayv2_api`, `aws_apigatewayv2_stage`, `aws_apigatewayv2_integration`, `aws_apigatewayv2_route` |
| REST | `apigateway.RestApi` | (same as HTTP) |

### CloudFront

| CDK | Terraform |
|-----|-----------|
| `cloudfront.Distribution` | `aws_cloudfront_distribution` |
| `cloudfront.ResponseHeadersPolicy` | `aws_cloudfront_response_headers_policy` |
| — | `aws_cloudfront_origin_access_control` |
| — | `aws_s3_bucket_policy` |

## Security & Identity

### Cognito

| CDK | Terraform |
|-----|-----------|
| `cognito.UserPool` | `aws_cognito_user_pool` |
| `cognito.UserPoolClient` | `aws_cognito_user_pool_client` |

## Observability

### CloudWatch

| CDK | Terraform |
|-----|-----------|
| `cloudwatch.Dashboard` | `aws_cloudwatch_dashboard` |
| `sns.Topic` (alarms) | `aws_sns_topic` (alarms) |

## Infrastructure (auto-resolved)

### VPC

Automatically added when Compute (ECS, EKS, EC2), Database (Aurora, RDS), Redshift, or OpenSearch (managed) is selected.

| CDK | Terraform |
|-----|-----------|
| `ec2.Vpc` | `aws_vpc` |
| — | `aws_subnet` x6 (public, private, isolated) |
| — | `aws_internet_gateway`, `aws_nat_gateway`, `aws_eip` |
| — | `aws_route_table` x3 + associations |
| — | `aws_flow_log` + IAM role + CloudWatch log group |

## Cross-Service Wiring

When multiple services are selected together, the generator automatically creates integration resources:

| Combination | Added Resources |
|-------------|----------------|
| Lambda + DynamoDB | IAM policy granting Lambda DynamoDB CRUD access |
| Lambda + Kinesis | `EventSourceMapping` (Lambda consumes Kinesis stream) |
| Lambda + SQS | `EventSourceMapping` (Lambda consumes SQS queue) |
| Lambda + EventBridge | EventBridge rule + target + Lambda permission |
| ECS + DynamoDB | IAM policy granting ECS task role DynamoDB access |
| Cognito + API Gateway | JWT authorizer added to API Gateway routes |
| Bedrock Agents + KB | Knowledge base association on the agent |
| Bedrock KB + OpenSearch | Storage configuration referencing OpenSearch collection/domain |
| CloudWatch + services | Dashboard widgets for selected service metrics |

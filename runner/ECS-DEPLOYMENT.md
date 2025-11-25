# Runner ECS Deployment Guide

This document describes how to deploy the Runner service to AWS ECS Fargate.

## Architecture Overview

```
GitHub Push → GitHub Actions → ECR → ECS Fargate
                    ↓                    ↓
              Build Docker Image    Deploy Runner
```

## Prerequisites

### 1. AWS Resources Required

- **ECR Repository**: `uoc-tfm/runner`
- **ECS Cluster**: Your ECS cluster name
- **ECS Service**: Worker service (e.g., `uoc-tfm-worker-service`)
- **IAM Role**: ECS Task Execution Role with permissions for:
  - ECR image pulling
  - CloudWatch Logs
  - SQS access
  - S3 access
  - RDS access

### 2. GitHub Secrets

Configure these secrets in your GitHub repository:

```
AWS_ACCESS_KEY_ID       # AWS credentials for ECR/ECS access
AWS_SECRET_ACCESS_KEY   # AWS credentials
AWS_REGION              # e.g., eu-south-2
ECR_ACCOUNT_ID          # Your AWS account ID
```

### 3. GitHub Variables

Configure these variables in your GitHub repository:

```
ECS_CLUSTER            # ECS cluster name
ECS_WORKER_SERVICE     # Runner service name (e.g., uoc-tfm-worker-service)
```

## ECS Task Definition

### Container Configuration

```json
{
  "family": "uoc-tfm-runner",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "runner",
      "image": "451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:latest",
      "essential": true,
      "environment": [
        {
          "name": "AWS_REGION",
          "value": "eu-south-2"
        },
        {
          "name": "AWS_S3_BUCKET",
          "value": "uoc-tfm-eval-platform"
        },
        {
          "name": "AWS_SQS_QUEUE_URL",
          "value": "https://sqs.eu-south-2.amazonaws.com/451747690955/submissions-queue"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://postgres:TFMdb#SecureKey9@tfmdb.cfeggi80y56w.eu-south-2.rds.amazonaws.com:5432/tfmdb"
        },
        {
          "name": "RUNNER_POLL_INTERVAL_MS",
          "value": "20000"
        },
        {
          "name": "RUNNER_TIMEOUT_MS",
          "value": "120000"
        },
        {
          "name": "RUNNER_MAX_LOG_BYTES",
          "value": "200000"
        },
        {
          "name": "JDK_VERSION",
          "value": "17"
        },
        {
          "name": "BUILD_TOOL",
          "value": "maven"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/uoc-tfm-runner",
          "awslogs-region": "eu-south-2",
          "awslogs-stream-prefix": "runner"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "ps aux | grep 'node.*main.js' || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ],
  "taskRoleArn": "arn:aws:iam::451747690955:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::451747690955:role/ecsTaskExecutionRole"
}
```

### ECS Service Configuration

```json
{
  "serviceName": "uoc-tfm-worker-service",
  "cluster": "your-cluster-name",
  "taskDefinition": "uoc-tfm-runner:latest",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-xxx"],
      "assignPublicIp": "ENABLED"
    }
  }
}
```

## Environment Variables

All configuration is provided via **environment variables** in the ECS task definition.

**Note:** The current configuration does **not** use AWS Secrets Manager. All values, including `DATABASE_URL`, are passed as plain environment variables in the containerDefinitions.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `eu-south-2` |
| `AWS_S3_BUCKET` | S3 bucket for submissions | `uoc-tfm-eval-platform` |
| `AWS_SQS_QUEUE_URL` | SQS queue URL | `https://sqs.eu-south-2.amazonaws.com/451747690955/submissions-queue` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@tfmdb.xxx.eu-south-2.rds.amazonaws.com:5432/tfmdb` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUNNER_POLL_INTERVAL_MS` | SQS polling interval | `20000` |
| `RUNNER_TIMEOUT_MS` | Test execution timeout | `120000` |
| `RUNNER_MAX_LOG_BYTES` | Maximum log size | `200000` |
| `JDK_VERSION` | Java version | `17` |
| `BUILD_TOOL` | Build tool | `maven` |

## IAM Permissions Required

### Task Execution Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### Task Role

The task role provides permissions for the running container to access AWS services.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:eu-south-2:451747690955:submissions-queue"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::uoc-tfm-eval-platform/*"
    }
  ]
}
```

**Note on RDS Access:**
- RDS/PostgreSQL access is controlled via **VPC Security Groups**, not IAM
- The ECS task security group must allow outbound traffic to RDS on port 5432
- The RDS security group must allow inbound traffic from the ECS task security group
- No IAM permissions are required for PostgreSQL connections

**Current Configuration:**
- ✅ SQS permissions for message polling and deletion
- ✅ S3 permissions for submission downloads and log uploads
- ✅ RDS access via security group rules (not IAM)
- ❌ No AWS Secrets Manager permissions (DATABASE_URL passed as environment variable)

## Deployment Process

### Automatic Deployment (via GitHub Actions)

The runner service uses a fully automated CI/CD pipeline defined in `.github/workflows/ecr-push.yml`.

**Workflow Trigger:**
- Push to `main` branch with changes in:
  - `runner/**` (any Runner code changes)
  - `api/**` (API changes - builds both services)
  - `.github/workflows/ecr-push.yml` (workflow changes)

**Pipeline Steps:**

1. **Build & Push Job:**
   - Validates required AWS secrets
   - Checks out repository
   - Configures AWS credentials
   - Logs into Amazon ECR
   - Ensures ECR repositories exist (`uoc-tfm/runner`)
   - Builds Docker image for linux/amd64 platform
   - Pushes image to ECR with `latest` tag

2. **Redeploy ECS Job:**
   - Runs only if build succeeds
   - Forces new deployment of ECS Worker service
   - ECS pulls new image and performs rolling update

**Required GitHub Secrets:**
```
AWS_ACCESS_KEY_ID       # AWS credentials for ECR/ECS access
AWS_SECRET_ACCESS_KEY   # AWS secret key
AWS_REGION              # e.g., eu-south-2
ECR_ACCOUNT_ID          # Your AWS account ID (e.g., 451747690955)
```

**Required GitHub Variables:**
```
ECS_CLUSTER            # ECS cluster name
ECS_WORKER_SERVICE     # Runner service name (e.g., uoc-tfm-worker-service)
```

**Deployment Flow:**
```
Push to main (runner/**)
    ↓
GitHub Actions triggered
    ↓
Build Docker image (linux/amd64)
    ↓
Push to ECR (uoc-tfm/runner:latest)
    ↓
ECS force new deployment
    ↓
ECS pulls new image
    ↓
Rolling update (zero downtime)
    ↓
New tasks running ✓
```

**Verifying Deployment:**
```bash
# Check GitHub Actions status
gh run list --workflow=ecr-push.yml --limit 5

# Watch ECS deployment progress
aws ecs describe-services \
  --cluster your-cluster \
  --services uoc-tfm-worker-service \
  --query 'services[0].deployments'

# Tail logs to verify new version
aws logs tail /ecs/uoc-tfm-runner --follow --since 5m
```

### Manual Deployment

```bash
# 1. Build Docker image
cd runner
docker build -t uoc-tfm/runner:latest .

# 2. Tag for ECR
docker tag uoc-tfm/runner:latest \
  451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:latest

# 3. Login to ECR
aws ecr get-login-password --region eu-south-2 | \
  docker login --username AWS --password-stdin \
  451747690955.dkr.ecr.eu-south-2.amazonaws.com

# 4. Push to ECR
docker push 451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:latest

# 5. Update ECS service
aws ecs update-service \
  --cluster your-cluster \
  --service uoc-tfm-worker-service \
  --force-new-deployment
```

## Monitoring

### CloudWatch Logs

View runner logs in CloudWatch:

```bash
aws logs tail /ecs/uoc-tfm-runner --follow
```

**Note on S3 Execution Logs:**
Runner execution logs for each submission are stored in S3 at:
```
s3://uoc-tfm-eval-platform/logs/<submissionId>/run.log
```
These logs contain the complete stdout/stderr output from test execution and are accessible via the API's `/feedback/:submissionId` endpoint.

### ECS Service Status

Check service status:

```bash
aws ecs describe-services \
  --cluster your-cluster \
  --services uoc-tfm-worker-service
```

### Common Log Patterns

**Successful startup:**
```
🚀 Runner Service starting...
✓ Configuration loaded successfully
✓ Runner initialization complete
👀 Listening for submissions...
```

**Processing submission:**
```
============================================================
[ProcessingService] Starting pipeline for submission: xxx
============================================================
[Step 1/6] Downloading ZIP from S3...
✓ ZIP downloaded: ./tmp/xxx/submission.zip
...
✅ Pipeline completed successfully
```

**Error handling:**
```
❌ Pipeline failed for submission: xxx
Error: Failed to execute tests...
✓ Database updated with ERROR status
⚠️  Pipeline failed but runner continues
```

## Troubleshooting

### Container won't start

1. Check CloudWatch logs
2. Verify environment variables
3. Check IAM role permissions
4. Verify ECR image exists

### SQS messages not processed

1. Check SQS queue URL is correct
2. Verify IAM permissions for SQS
3. Check if runner is polling (logs should show polling activity)

### Database connection errors

1. Verify DATABASE_URL is correct
2. Check security groups allow RDS access
3. Verify RDS is accessible from ECS subnet

### S3 access errors

1. Check IAM permissions for S3
2. Verify bucket name is correct
3. Check if objects exist in S3

## Scaling

To scale the runner service:

```bash
aws ecs update-service \
  --cluster your-cluster \
  --service uoc-tfm-worker-service \
  --desired-count 3
```

**Considerations:**
- Multiple runners will poll SQS concurrently
- Each runner can process up to 10 messages simultaneously
- SQS visibility timeout ensures no duplicate processing

## Cost Optimization

- **Fargate Spot**: Use Spot instances for cost savings
- **Auto-scaling**: Scale based on SQS queue depth
- **Scheduled scaling**: Scale down during off-hours

## Security Best Practices

- ✅ Use non-root user in container (UID 1001)
- ✅ Environment variables via ECS task definition
- ✅ RDS access restricted by security groups
- ✅ Use VPC endpoints for AWS services (optional cost optimization)
- ✅ Enable container insights for monitoring
- ✅ Regular security scanning of Docker images
- ⚠️  Consider AWS Secrets Manager for production (currently using environment variables)

#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Provision ECS Fargate (NO ALB): API exposed via public IP (port 3000) + Worker
# Region: eu-south-2 | Profile: uoc-tfm
# Author: Manuel de Jesús González Arvelo (TFM UOC)
# ------------------------------------------------------------------------------

set -euo pipefail

# ====== CONFIG (EDIT THIS) =====================================================
PROFILE="${PROFILE:-uoc-tfm}"
REGION="${REGION:-eu-south-2}"

# VPC and PUBLIC subnets (different AZs). Replace with your values:
VPC_ID="${VPC_ID:-vpc-031ad88bc6e48f832}"
SUBNETS=(
  "${SUBNET_A:-subnet-08b648fa5d49a1ab0}"  # eu-south-2a (public)
  "${SUBNET_B:-subnet-03c591c67f3eff033}"  # eu-south-2c (public)
)

# Existing RDS SG (ingress 5432 from ECS SG will be added)
RDS_SG_ID="${RDS_SG_ID:-sg-0ddd2f2198ca11ebe}"

# App config (from your envs)
S3_BUCKET="${S3_BUCKET:-uoc-tfm-eval-platform}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --profile "$PROFILE")"
SQS_URL="${SQS_URL:-https://sqs.${REGION}.amazonaws.com/${ACCOUNT_ID}/submissions-queue}"
SES_REGION="${SES_REGION:-eu-west-1}"
SES_SENDER="${SES_SENDER:-mgonzalezarve@uoc.edu}"

# ECR image URIs (ensure images exist or push later)
ECR_API_URI="${ECR_API_URI:-${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/uoc-tfm/api:latest}"
ECR_RUNNER_URI="${ECR_RUNNER_URI:-${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/uoc-tfm/runner:latest}"

# ECS naming
CLUSTER="${CLUSTER:-uoc-tfm-cluster}"
ECS_SG_NAME="${ECS_SG_NAME:-tfm-ecs-sg}"
API_SERVICE="${API_SERVICE:-api-service}"
WORKER_SERVICE="${WORKER_SERVICE:-worker-service}"

DB_HOST="${DB_HOST:-tfmdb.cfeggi80y56w.${REGION}.rds.amazonaws.com}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-TFMdb#SecureKey9}"
DB_NAME="${DB_NAME:-tfmdb}"
DB_SSL="${DB_SSL:-true}"
DB_URL="${DB_URL:-postgresql://postgres:TFMdb%23SecureKey9@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require}"

# ====== PRECHECKS ==============================================================
command -v aws >/dev/null || { echo "AWS CLI not found"; exit 1; }
command -v jq  >/dev/null || { echo "jq not found (brew install jq / apt-get install jq)"; exit 1; }
echo ">>> Using profile=$PROFILE region=$REGION account=$ACCOUNT_ID"

# Build subnets JSON list for awsvpcConfiguration
SUBNETS_JSON=$(printf '"%s",' "${SUBNETS[@]}")
SUBNETS_JSON="[${SUBNETS_JSON%,}]"

# ====== CREATE/GET ECS CLUSTER ================================================
echo ">>> Ensuring ECS cluster: $CLUSTER"
aws ecs describe-clusters --clusters "$CLUSTER" --region "$REGION" --profile "$PROFILE" \
  --query "clusters[?clusterName=='$CLUSTER'].clusterName" --output text | grep -q "$CLUSTER" \
  || aws ecs create-cluster --cluster-name "$CLUSTER" --region "$REGION" --profile "$PROFILE" >/dev/null
echo "✓ Cluster ready"

# ====== CLOUDWATCH LOG GROUPS =================================================
for LG in /ecs/api /ecs/worker; do
  echo ">>> Ensuring log group $LG"
  aws logs describe-log-groups --log-group-name-prefix "$LG" --region "$REGION" --profile "$PROFILE" \
    --query 'logGroups[].logGroupName' --output text | grep -q "$LG" \
    || aws logs create-log-group --log-group-name "$LG" --region "$REGION" --profile "$PROFILE"
done
echo "✓ Log groups ready"

# ====== SECURITY GROUP (ECS) ==================================================
echo ">>> Ensuring ECS Security Group"
ECS_SG_ID=$(
  aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=$ECS_SG_NAME" \
    --region "$REGION" --profile "$PROFILE" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true
)
if [[ -z "$ECS_SG_ID" || "$ECS_SG_ID" == "None" ]]; then
  ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$ECS_SG_NAME" --description "ECS tasks (API public, Worker private)" \
    --vpc-id "$VPC_ID" --region "$REGION" --profile "$PROFILE" \
    --query 'GroupId' --output text)
fi
# Ingress for API port 3000 from Internet (demo)
aws ec2 authorize-security-group-ingress \
  --group-id "$ECS_SG_ID" --protocol tcp --port 3000 --cidr 0.0.0.0/0 \
  --region "$REGION" --profile "$PROFILE" >/dev/null 2>&1 || true

# Allow ECS → RDS (via RDS SG)
aws ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG_ID" --protocol tcp --port 5432 --source-group "$ECS_SG_ID" \
  --region "$REGION" --profile "$PROFILE" >/dev/null 2>&1 || true
echo "✓ ECS SG: $ECS_SG_ID (3000 open) + RDS rule added"

# ====== IAM ROLES =============================================================
echo ">>> Ensuring IAM roles"

# Execution Role (pull ECR + logs)
if ! aws iam get-role --role-name ecsTaskExecutionRole-tfm >/dev/null 2>&1; then
  cat > /tmp/exec-trust.json <<'JSON'
{ "Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
  aws iam create-role --role-name ecsTaskExecutionRole-tfm \
    --assume-role-policy-document file:///tmp/exec-trust.json >/dev/null
  aws iam attach-role-policy --role-name ecsTaskExecutionRole-tfm \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
fi
EXEC_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole-tfm --query 'Role.Arn' --output text)

# API Task Role
if ! aws iam get-role --role-name ecsTaskRoleApi-tfm >/dev/null 2>&1; then
  cat > /tmp/api-task-trust.json <<'JSON'
{ "Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
  aws iam create-role --role-name ecsTaskRoleApi-tfm \
    --assume-role-policy-document file:///tmp/api-task-trust.json >/dev/null
fi
cat > /tmp/api-task-policy.json <<JSON
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::${S3_BUCKET}/*"]},
    {"Effect":"Allow","Action":["sqs:SendMessage"],"Resource":"*"},
    {"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"},
    {"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"*"},
    {"Effect":"Allow","Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"}
  ]
}
JSON
aws iam put-role-policy --role-name ecsTaskRoleApi-tfm --policy-name ecsTaskRoleApiPolicy \
  --policy-document file:///tmp/api-task-policy.json >/dev/null
API_TASK_ROLE_ARN=$(aws iam get-role --role-name ecsTaskRoleApi-tfm --query 'Role.Arn' --output text)

# Worker Task Role
if ! aws iam get-role --role-name ecsTaskRoleWorker-tfm >/dev/null 2>&1; then
  cat > /tmp/worker-task-trust.json <<'JSON'
{ "Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
  aws iam create-role --role-name ecsTaskRoleWorker-tfm \
    --assume-role-policy-document file:///tmp/worker-task-trust.json >/dev/null
fi
cat > /tmp/worker-task-policy.json <<JSON
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::${S3_BUCKET}/*"]},
    {"Effect":"Allow","Action":["sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"],"Resource":"*"},
    {"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],"Resource":"*"},
    {"Effect":"Allow","Action":["logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"}
  ]
}
JSON
aws iam put-role-policy --role-name ecsTaskRoleWorker-tfm --policy-name ecsTaskRoleWorkerPolicy \
  --policy-document file:///tmp/worker-task-policy.json >/dev/null
WORKER_TASK_ROLE_ARN=$(aws iam get-role --role-name ecsTaskRoleWorker-tfm --query 'Role.Arn' --output text)

echo "✓ IAM roles ready"

# ====== TASK DEFINITIONS ======================================================
echo ">>> Registering task definitions"

cat > /tmp/api-task.json <<JSON
{
  "family": "api-task",
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "requiresCompatibilities": ["FARGATE"],
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${API_TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "${ECR_API_URI}",
      "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
      "environment": [
        {"name":"AWS_REGION","value":"${REGION}"},
        {"name":"SES_REGION","value":"${SES_REGION}"},
        {"name":"SES_SENDER","value":"${SES_SENDER}"},
        {"name":"AWS_S3_BUCKET","value":"${S3_BUCKET}"},
        {"name":"AWS_SQS_QUEUE_URL","value":"${SQS_URL}"},
        {"name":"DB_HOST","value":"${DB_HOST}"},
        {"name":"DB_PORT","value":"${DB_PORT}"},
        {"name":"DB_USER","value":"${DB_USER}"},
        {"name":"DB_PASS","value":"${DB_PASS}"},
        {"name":"DB_NAME","value":"${DB_NAME}"},
        {"name":"DB_SSL","value":"${DB_SSL}"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {"awslogs-group":"/ecs/api","awslogs-region":"${REGION}","awslogs-stream-prefix":"ecs"}
      }
    }
  ]
}
JSON

cat > /tmp/worker-task.json <<JSON
{
  "family": "worker-task",
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024",
  "requiresCompatibilities": ["FARGATE"],
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${WORKER_TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "worker",
      "image": "${ECR_RUNNER_URI}",
      "environment": [
        {"name":"AWS_REGION","value":"${REGION}"},
        {"name":"AWS_S3_BUCKET","value":"${S3_BUCKET}"},
        {"name":"AWS_SQS_QUEUE_URL","value":"${SQS_URL}"},
        {"name":"DATABASE_URL","value":"${DB_URL}"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {"awslogs-group":"/ecs/worker","awslogs-region":"${REGION}","awslogs-stream-prefix":"ecs"}
      }
    }
  ]
}
JSON

API_TD_ARN=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/api-task.json \
  --region "$REGION" --profile "$PROFILE" \
  --query 'taskDefinition.taskDefinitionArn' --output text)

WORKER_TD_ARN=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/worker-task.json \
  --region "$REGION" --profile "$PROFILE" \
  --query 'taskDefinition.taskDefinitionArn' --output text)

echo "✓ Task defs => API: $API_TD_ARN | WORKER: $WORKER_TD_ARN"

# ====== SERVICES (assignPublicIp=ENABLED) =====================================
echo ">>> Ensuring API service (public IP on port 3000)"
if ! aws ecs describe-services --cluster "$CLUSTER" --services "$API_SERVICE" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'services[0].serviceName' --output text 2>/dev/null | grep -q "$API_SERVICE"; then
  aws ecs create-service \
    --cluster "$CLUSTER" \
    --service-name "$API_SERVICE" \
    --task-definition "$API_TD_ARN" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=${SUBNETS_JSON},securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
    --region "$REGION" --profile "$PROFILE" >/dev/null
else
  aws ecs update-service \
    --cluster "$CLUSTER" --service "$API_SERVICE" \
    --task-definition "$API_TD_ARN" \
    --region "$REGION" --profile "$PROFILE" >/dev/null
fi
echo "✓ API service ready"

echo ">>> Ensuring WORKER service"
if ! aws ecs describe-services --cluster "$CLUSTER" --services "$WORKER_SERVICE" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'services[0].serviceName' --output text 2>/dev/null | grep -q "$WORKER_SERVICE"; then
  aws ecs create-service \
    --cluster "$CLUSTER" \
    --service-name "$WORKER_SERVICE" \
    --task-definition "$WORKER_TD_ARN" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=${SUBNETS_JSON},securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
    --region "$REGION" --profile "$PROFILE" >/dev/null
else
  aws ecs update-service \
    --cluster "$CLUSTER" --service "$WORKER_SERVICE" \
    --task-definition "$WORKER_TD_ARN" \
    --region "$REGION" --profile "$PROFILE" >/dev/null
fi
echo "✓ WORKER service ready"

# ====== OUTPUT: PUBLIC IP of API =============================================
echo ">>> Fetching API Public IP (may take ~60-90s if tasks are starting)..."

# wait until a task ARN exists
for i in {1..30}; do
  TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$API_SERVICE" \
    --region "$REGION" --profile "$PROFILE" --query 'taskArns[0]' --output text)
  [[ "$TASK_ARN" != "None" && -n "$TASK_ARN" ]] && break || { echo "  waiting task..."; sleep 5; }
done

if [[ "$TASK_ARN" == "None" || -z "$TASK_ARN" ]]; then
  echo "!! Could not find running API task. Check ECS console logs."; exit 1
fi

ENI_ID=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)

PUB_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI_ID" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

echo
echo "============================================================"
echo " ECS provisioned successfully!"
echo " Cluster:      $CLUSTER"
echo " API service:  $API_SERVICE"
echo " Worker svc:   $WORKER_SERVICE"
echo " Public IP:    $PUB_IP"
echo " Healthcheck:  http://${PUB_IP}:3000/health"
echo " Logs API:     /ecs/api (CloudWatch)"
echo " Logs Worker:  /ecs/worker (CloudWatch)"
echo "============================================================"
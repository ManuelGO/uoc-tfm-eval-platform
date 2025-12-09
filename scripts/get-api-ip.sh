#!/usr/bin/env bash
# ----------------------------------------------------------------------
# Fetch current Public IP of the API ECS task (uoc-tfm)
# Author: Manuel González Arvelo
# ----------------------------------------------------------------------

set -euo pipefail

CLUSTER="${CLUSTER:-uoc-tfm-cluster}"
SERVICE="${SERVICE:-api-service}"
REGION="${REGION:-eu-south-2}"
PROFILE="${PROFILE:-uoc-tfm}"

echo ">>> Fetching API Public IP..."
echo "    Cluster: $CLUSTER"
echo "    Service: $SERVICE"
echo

# 1. Obtener ARN del task
TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --service-name "$SERVICE" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'taskArns[0]' \
  --output text)

if [[ "$TASK_ARN" == "None" || -z "$TASK_ARN" ]]; then
  echo "!! ERROR: No running task found for service '$SERVICE'"
  exit 1
fi

echo "✓ Task ARN: $TASK_ARN"

# 2. Obtener ENI asociado al task
ENI_ID=$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

echo "✓ ENI ID: $ENI_ID"

# 3. Obtener IP pública
API_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids "$ENI_ID" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text)

if [[ "$API_IP" == "None" || -z "$API_IP" ]]; then
  echo "!! ERROR: No Public IP found for ENI"
  exit 1
fi

echo
echo "============================================================"
echo " API Public IP:  $API_IP"
echo " Healthcheck:    http://$API_IP:3000/health"
echo " Export for FE:  export API_IP=$API_IP"
echo "============================================================"
echo

# export it for current shell
echo "export API_IP=$API_IP"
#!/usr/bin/env bash
# ------------------------------------------------------------------
# Script: create-ecr.sh
# Purpose: Create Amazon ECR repositories for API and Runner
# Author: Manuel de Jesús González Arvelo
# Region: eu-south-2 (Spain)
# ------------------------------------------------------------------

set -e  # Exit on error

# ---------- CONFIGURATION ----------
PROFILE="uoc-tfm"
REGION="eu-south-2"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)

REPOS=("uoc-tfm/api" "uoc-tfm/runner")

# ---------- COLORS ----------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ---------- FUNCTIONS ----------
create_repo() {
  local repo=$1
  echo -e "${YELLOW}→ Checking repository: ${repo}${NC}"

  if aws ecr describe-repositories --repository-names "$repo" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Repository already exists:${NC} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${repo}"
  else
    echo -e "${YELLOW}→ Creating repository: ${repo}${NC}"
    aws ecr create-repository \
      --repository-name "$repo" \
      --image-scanning-configuration scanOnPush=true \
      --region $REGION \
      --profile $PROFILE >/dev/null
    echo -e "${GREEN}✓ Created:${NC} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${repo}"
  fi
}

# ---------- MAIN ----------
echo -e "${GREEN}=== Creating ECR repositories in ${REGION} (profile: ${PROFILE}) ===${NC}"

for repo in "${REPOS[@]}"; do
  create_repo "$repo"
done

echo -e "${YELLOW}→ Authenticating Docker with ECR...${NC}"
aws ecr get-login-password --region $REGION --profile $PROFILE | \
docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

echo -e "${GREEN}✓ Docker login succeeded!${NC}"
echo -e "${GREEN}All repositories verified and ready.${NC}"

# ---------- OUTPUT SUMMARY ----------
echo -e "\n${YELLOW}Repository URIs:${NC}"
for repo in "${REPOS[@]}"; do
  echo "- ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${repo}"
done

echo -e "\n${GREEN}Done!${NC}"
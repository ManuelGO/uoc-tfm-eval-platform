# 🧭 Deployment Notes — UOC TFM Evaluation Platform

This document summarizes the deployment steps, AWS resources, and redeployment procedures used during **Phase 1** of the project infrastructure setup.

---

## ☁️ AWS Infrastructure Overview

The following AWS resources were provisioned as part of the backend infrastructure:

| Resource | Description |
|-----------|--------------|
| **ECR** | Two repositories: `uoc-tfm/api` and `uoc-tfm/runner` for container images. |
| **RDS** | PostgreSQL instance `tfmdb` with multi-AZ subnets (eu-south-2a/b/c). |
| **SQS** | Queue `submissions-queue` for handling student submission jobs. |
| **SES** | Configured for passwordless login email delivery (verified sender). |
| **ECS** | Fargate cluster `uoc-tfm-cluster` with two services: `api-service` and `worker-service`. |
| **CloudWatch** | Log groups `/ecs/api` and `/ecs/worker` for monitoring and diagnostics. |

---

## 🚀 ECS Deployment Summary

The API and worker containers are deployed on **AWS Fargate** under the cluster:

Cluster: uoc-tfm-cluster
Services: api-service, worker-service
Region: eu-south-2 (Spain)

Current deployment status:
- ✅ ECS cluster running
- ✅ Containers responding (`curl http://<public-ip>:3000 → HTTP 200 OK`)
- ✅ Logs accessible in CloudWatch
- ✅ RDS, SQS, and SES integrated
- ⚙️ GitHub Actions CI/CD configured (build + push; redeploy WIP)

---

## 🔄 Manual ECS Redeployment

If you need to redeploy your ECS services manually (instead of waiting for the GitHub Actions workflow to complete), use the following commands locally:

```bash
aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service api-service \
  --force-new-deployment \
  --region eu-south-2 \
  --profile uoc-tfm

aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service worker-service \
  --force-new-deployment \
  --region eu-south-2 \
  --profile uoc-tfm
  ```
These commands force ECS to pull the latest images from ECR and restart both services with the updated containers.
## ⚙️ GitHub Actions Workflow (CI/CD)

The workflow defined in  
`.github/workflows/ecr-push.yml` automates the continuous integration and deployment process for this project.  
It builds Docker images for both the **API** and **Runner** services, pushes them to **Amazon ECR**, and then triggers a new deployment in **ECS**.

### 🔑 Required Secrets
Configured under:  
**Settings → Secrets and variables → Actions → Secrets**

| Name | Example Value | Description |
|------|----------------|-------------|
| `AWS_ACCESS_KEY_ID` | *(your IAM access key)* | Key used by GitHub Actions to authenticate with AWS. |
| `AWS_SECRET_ACCESS_KEY` | *(your IAM secret key)* | Secret associated with the IAM user above. |
| `AWS_REGION` | `eu-south-2` | AWS region for all operations (Spain). |
| `ECR_ACCOUNT_ID` | `451747690955` | AWS account ID hosting the ECR repositories. |

### ⚙️ Required Variables
Configured under:  
**Settings → Secrets and variables → Actions → Variables**

| Variable | Example | Description |
|-----------|----------|-------------|
| `ECS_CLUSTER` | `uoc-tfm-cluster` | Name of the ECS cluster where services are deployed. |
| `ECS_API_SERVICE` | `api-service` | ECS service handling API requests. |
| `ECS_WORKER_SERVICE` | `worker-service` | ECS service running background jobs. |

---

### 🧩 Workflow Behavior

The workflow performs the following steps:

1. **Checkout the repository** from GitHub.  
2. **Authenticate** with AWS using the configured secrets.  
3. **Log in to Amazon ECR** using `aws-actions/amazon-ecr-login`.  
4. **Build and push** Docker images for both `api` and `runner` services using `docker buildx`.  
5. **Trigger ECS redeployment** (`api-service` and `worker-service`) with `--force-new-deployment`.

---

### 🧰 Execution Notes

- Ensure that your commits **touch the correct paths** (`api/**`, `runner/**`) so that the workflow triggers.  
  Alternatively, remove the `paths:` filter in `.github/workflows/ecr-push.yml` to execute on every push.
- On successful execution, both images are updated in ECR and ECS automatically redeploys the latest containers.
- If the workflow fails or is skipped, you can redeploy manually using:

```bash
aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service api-service \
  --force-new-deployment \
  --region eu-south-2 \
  --profile uoc-tfm

aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service worker-service \
  --force-new-deployment \
  --region eu-south-2 \
  --profile uoc-tfm
  ```


  ---

## 💸 Cost and Cleanup Recommendations

To avoid unnecessary AWS charges when the project is idle, it is recommended to scale down or pause services whenever development is not active.

### 🧱 Scale Down ECS Services
Reduce the desired task count to zero for both the API and Worker services:
```bash
aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service api-service \
  --desired-count 0 \
  --region eu-south-2 \
  --profile uoc-tfm

aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service worker-service \
  --desired-count 0 \
  --region eu-south-2 \
  --profile uoc-tfm
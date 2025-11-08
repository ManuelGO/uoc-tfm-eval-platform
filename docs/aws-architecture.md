# ☁️ AWS Architecture - UOC TFM Automatic Code Evaluation Platform

**Author:** Manuel de Jesús González Arvelo  
**Region:** `eu-south-2` (Spain)  
**Scope:** MVP ready for demo + path to production

---

## 1. Goals & Constraints
- **Primary goal (MVP):** Reliable, isolated execution of students' submissions (JUnit) with automatic feedback.
- **Constraints:** Short timeline, low ops overhead, EU data location, simple scaling, predictable costs.
- **Non-goals (now):** Advanced AI feedback, exam engine, multi-language beyond Java.

---

## 2. High-Level Architecture
´´´
[User] ──HTTPS──> [CloudFront (optional) + S3 (Web)]

└──HTTPS──> [ALB] ──> [ECS Fargate: API (NestJS)]
|             
|              └── [SES] (magic links)
|
├──> [SQS: submissions queue]
|
├──> [RDS PostgreSQL]  (results, users, pits)
|
ZIP (presigned)  ───┘
[S3 bucket: submissions + logs] <─── [ECS Fargate runTask: Runner (JUnit/Maven)]
´´´

**Why this design?**
- **ECS Fargate**: containerized API with no servers to manage.
- **runTask per submission**: isolation for untrusted code, predictable costs.
- **SQS**: durable queue decouples API from runner execution.
- **S3**: scalable storage for ZIPs and logs; presigned URLs reduce API load.
- **RDS PostgreSQL**: relational data and consistency; easy backups.
- **SES**: passwordless login emails with a verified sender/domain.
- **ECR**: private image registry for API and runner.

---

## 3. Components

### 3.1 Networking & IAM
- **VPC** with 2 AZs:
  - Public subnets: ALB, NAT Gateway
  - Private subnets: ECS API/Runner tasks, RDS
- **Security Groups**:
  - ALB: inbound 443 from Internet; outbound to API
  - API tasks: inbound from ALB only; outbound to RDS, SQS, SES, S3
  - RDS: inbound only from API/Runner SGs
- **IAM Roles (least privilege)**:
  - `ecsTaskRoleApi`: S3 (limited), SQS:SendMessage, SES:SendEmail, SecretsManager:Get
  - `ecsTaskRoleRunner`: S3 (limited prefixes), SQS:Receive/Delete, CloudWatch logs
  - `ecsExecutionRole`: ECR pull, CloudWatch logs

### 3.2 Compute
- **ECS Fargate Service – API (NestJS)** behind **ALB** (HTTPS via ACM).
- **ECS Fargate Task – Runner** started **per submission** (from SQS message).

### 3.3 Storage & Data
- **S3** bucket `uoc-tfm-eval-platform`:
  - `submissions/` ZIP uploads (via presigned PUT)
  - `results/` parsed JUnit JSON
  - `logs/` trimmed execution logs
- **RDS PostgreSQL** for users, pits, activations, submissions, results.

### 3.4 Messaging & Email
- **SQS** queue `submissions-queue` for decoupled job processing.
- **SES** for passwordless magic links (domain verification + DKIM).

### 3.5 Images & Secrets
- **ECR**: `api` and `runner` images.
- **Secrets Manager**: DB credentials, JWT secret, SES SMTP/API credentials.

---

## 4. Data Flow (Submission Lifecycle)

1. **Login (passwordless):**
   - API → SES sends magic link
   - User clicks link → API issues JWT

2. **Create pit & upload tests (professor):**
   - API stores tests package reference (S3 path or internal storage)

3. **Activate pit (student) & upload ZIP:**
   - API issues S3 **presigned URL** → student uploads ZIP directly to S3
   - API enqueues job in **SQS** with metadata (pitId, userId, S3 key)

4. **Runner execution (Fargate runTask):**
   - Runner consumes SQS message
   - Downloads ZIP (and tests), runs **Maven/Gradle + JUnit**
   - Parses **JUnit XML** → JSON, uploads logs/results to S3
   - Persists summary in **RDS** (passed/failed/errors, duration)

5. **Feedback:**
   - Student/Professor fetch results via API
   - Optional email notification

---

## 5. Security

- **Network isolation:** API/Runner in private subnets; RDS private; ALB public HTTPS only.
- **TLS everywhere:** ACM certificate on ALB; presigned S3 URLs (HTTPS).
- **Least privilege IAM:** tasks scoped to prefixes (e.g., `s3://bucket/submissions/*`).
- **Secrets:** managed by **AWS Secrets Manager**; never in Git.
- **Sandboxed execution:** one Fargate task per submission; CPU/mem limits; no outbound network if feasible.
- **Validation:** file size/type checks; timeouts; log truncation.

---

## 6. Observability

- **CloudWatch Logs**: API and Runner streams with correlation IDs (submissionId).
- **Metrics & Alarms**:
  - ALB 5xx > threshold (alarm)
  - ECS CPU/Mem > 80% (alarm)
  - SQS queue depth (alarm)
  - RDS connections / free storage
- **Health checks**: `/health` endpoint in API.

---

## 7. Region & Cost Rationale

- **Region:** `eu-south-2` (Spain) → **EU data residency**, low latency from Spain, GDPR-friendly.
- **Cost drivers:** Fargate task minutes (runner), RDS instance hours, NAT Gateway (optimize!), S3/CloudFront egress if web hosted.
- **Savings:** small RDS instance, scale-to-zero runner (on-demand), avoid NAT where possible (VPC endpoints), lifecycle rules on S3 logs.

---

## 8. Deployment Strategy

- **CI/CD (GitHub Actions):**
  - Build & push images to **ECR**
  - Deploy ECS service (API) via `aws-actions/amazon-ecs-deploy-task-definition`
  - Run DB migrations (Prisma/TypeORM) on deploy
- **Infra as Code (later):** Terraform or AWS CDK templates stored under `/infra`.

---

## 9. Future Evolution (beyond MVP)

- **AWS Batch** or **Step Functions** for more complex workflows.
- **CloudFront + S3 (static web)** + custom domain/ACM.
- **WAF** on ALB; IP rate limiting on login.
- **Analysis static tools** (PMD/flake8) as additional metrics.
- **Multi-language runners** (Docker images per language).

---

## 10. References
- AWS ECS Fargate, SQS, RDS, S3, SES documentation
- Security best practices for IAM and VPC
- UOC TFM requirements and project scope
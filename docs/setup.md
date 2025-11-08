# 🧰 Environment Setup Guide  
**Project:** UOC TFM – Automatic Code Evaluation Platform  
**Author:** Manuel de Jesús González Arvelo  
**Last updated:** 2025-10-20  

---

## 1️⃣ Prerequisites
Before running or deploying the project, make sure the following tools are installed:

| Tool | Minimum Version | Description |
|------|------------------|--------------|
| **Git** | 2.40+ | Version control |
| **Node.js** | 20+ | Runtime for API and frontend |
| **npm** | 10+ | Dependency manager |
| **AWS CLI** | 2.x | Command-line interface for AWS |
| **Docker** | 24+ | Used for container builds and runner jobs |
| **GitHub CLI (gh)** | Optional | For repository management |

---

## 2️⃣ AWS Account Setup

1. **Create an AWS account** using your institutional (UOC) or dedicated email.  
2. Enable **Multi-Factor Authentication (MFA)** for the root user.  
3. Create an IAM user named `tfm-admin` with the `AdministratorAccess` policy.  
4. Enable **programmatic access** (Access Key + Secret Key).  
5. Note down your credentials securely.

---

## 3️⃣ AWS CLI Configuration

Run the following to set up the local CLI profile:

```bash
aws configure --profile uoc-tfm
```

### Enter:
```bash
AWS Access Key ID [None]: <your key>
AWS Secret Access Key [None]: <your secret>
Default region name [None]: eu-south-2
Default output format [None]: json
```
### Verify:
```bash
aws sts get-caller-identity --profile uoc-tfm
```
### Expected output:
```bash
{
    "UserId": "AIDAEXAMPLEUSER",
    "Account": "451747690955",
    "Arn": "arn:aws:iam::451747690955:user/tfm-admin"
}
```
## 4) Repository Structure
After cloning the GitHub repository:
```bash
uoc-tfm-eval-platform/
├── api/          # NestJS backend
├── web/          # Angular frontend
├── runner/       # Docker test runner
├── infra/        # AWS infrastructure (Terraform or CDK)
├── docs/         # Documentation and setup guides
└── .github/      # CI/CD workflows
```
## 5) Environment Variables
A base .env.example file is included at the root of the project.
Copy it and fill in your own values:
```bash
cp .env.example .env
```
#### Example: 
```bash
AWS_REGION=eu-south-2
AWS_S3_BUCKET=uoc-tfm-eval-platform
AWS_SQS_QUEUE=submissions-queue
AWS_SES_SENDER=noreply@tfm-uoc.edu
DB_URL=postgresql://user:pass@host:5432/tfmdb
JWT_SECRET=changeme
FRONTEND_URL=https://tfm-uoc.example.com
```

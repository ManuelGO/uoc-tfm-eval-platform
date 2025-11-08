# 🗺️ UOC TFM Roadmap – Automatic Code Evaluation Platform

**Author:** Manuel de Jesús González Arvelo  
**Master’s Program:** MUII – Universitat Oberta de Catalunya (UOC)  
**Region:** `eu-south-2 (Spain)`  
**Repository:** [ManuelGO/uoc-tfm-eval-platform](https://github.com/ManuelGO/uoc-tfm-eval-platform)

---

## 🎯 Objective
Develop a cloud-based platform that allows students to:
- Upload their programming assignments (ZIP)
- Run automated tests and receive feedback instantly
- Enable professors to manage activities and test suites

The project demonstrates a **secure, scalable, and automated evaluation workflow** using AWS, Docker, and modern web technologies.

---

## 🧩 Phase 0 – Environment & Repository Setup
- [x] **[#AWS-1]** Create AWS account using institutional email  
- [x] **[#AWS-2]** Create GitHub repository and initialize project structure  
- [x] **[#AWS-3]** Configure CI/CD (GitHub Actions basic pipeline)  
- [x] **[#AWS-4]** Set up AWS CLI profile (`uoc-tfm`)  
- [x] **[#AWS-5]** Create S3 bucket (`uoc-tfm-eval-platform`)  
- [x] **[#AWS-6]** Define `.env.example` for all components  
- [x] **[#AWS-7]** Document architecture (`docs/aws-architecture.md`)  

---

## ☁️ Phase 1 – Core AWS Infrastructure
- [ ] **[#AWS-8]** Create ECR repositories (`api`, `runner`)  
- [ ] **[#AWS-9]** Create RDS PostgreSQL instance (`tfmdb`)  
- [ ] **[#AWS-10]** Create SQS queue for submission jobs  
- [ ] **[#AWS-11]** Configure SES for passwordless login  
- [ ] **[#AWS-12]** Create ECS cluster with 2 services (API + Worker)  
- [ ] **[#AWS-13]** Define IAM roles and task policies  
- [ ] **[#AWS-14]** Configure Secrets Manager (DB, JWT, SES)  
- [ ] **[#AWS-15]** Update CI/CD to push Docker images to ECR  

---

## 🧠 Phase 2 – Backend Development (NestJS API)
- [ ] **[#API-1]** Initialize NestJS backend  
- [ ] **[#API-2]** Implement passwordless authentication via SES  
- [ ] **[#API-3]** Add user, pit (assignment), and submission models  
- [ ] **[#API-4]** Upload submission ZIP via S3 presigned URL  
- [ ] **[#API-5]** Enqueue submission job in SQS  
- [ ] **[#API-6]** Receive and return feedback from S3/RDS  
- [ ] **[#API-7]** Add `/health` and basic test endpoints  
- [ ] **[#API-8]** Containerize API (Dockerfile + ECS deploy)  

---

## ⚙️ Phase 3 – Runner Development
- [ ] **[#RUN-1]** Initialize Runner service (Node/Python)  
- [ ] **[#RUN-2]** Connect to SQS queue and poll messages  
- [ ] **[#RUN-3]** Download ZIP + test package from S3  
- [ ] **[#RUN-4]** Run JUnit/Maven tests (isolated execution)  
- [ ] **[#RUN-5]** Parse JUnit XML → JSON summary  
- [ ] **[#RUN-6]** Upload logs/results to S3 and store summary in RDS  
- [ ] **[#RUN-7]** Containerize Runner (Dockerfile + ECR push)  
- [ ] **[#RUN-8]** Send logs to CloudWatch  

---

## 💻 Phase 4 – Frontend (Angular 17+)
- [ ] **[#WEB-1]** Initialize Angular project  
- [ ] **[#WEB-2]** Implement login flow (email + magic link)  
- [ ] **[#WEB-3]** Dashboard: list pits and submission status  
- [ ] **[#WEB-4]** Submission upload (S3 presigned URL)  
- [ ] **[#WEB-5]** Feedback view (tests, logs)  
- [ ] **[#WEB-6]** Add localization (ES/EN)  
- [ ] **[#WEB-7]** Optional: deploy static site (S3 + CloudFront)  

---

## 🔒 Phase 5 – Security, Observability & Optimization
- [ ] **[#SEC-1]** Review IAM least-privilege policies  
- [ ] **[#SEC-2]** Configure Secrets Manager injection  
- [ ] **[#SEC-3]** Enable HTTPS (ACM certificate + ALB)  
- [ ] **[#OBS-1]** Enable CloudWatch metrics and alarms  
- [ ] **[#OBS-2]** Configure log retention and tagging  
- [ ] **[#OPS-1]** Review cost and optimize Fargate/NAT usage  

---

## 🧪 Phase 6 – Integration & Testing
- [ ] **[#INT-1]** End-to-end test (submission → feedback)  
- [ ] **[#INT-2]** Load sample exercises and test cases  
- [ ] **[#INT-3]** Error handling (failed build, timeout, large ZIP)  
- [ ] **[#INT-4]** Demo account setup for tutor  
- [ ] **[#INT-5]** Record demo video  

---

## 📚 Phase 7 – Documentation & Delivery
- [ ] **[#DOC-1]** Update README.md (build, deploy, usage)  
- [ ] **[#DOC-2]** Update setup and architecture docs  
- [ ] **[#DOC-3]** Add API docs (Swagger/OpenAPI)  
- [ ] **[#DOC-4]** Write final TFM report (methodology, results, future work)  
- [ ] **[#DOC-5]** Package final submission (ZIP or GitHub release)  

---

## 🧭 Milestone Summary

| Phase | Deliverable | Status |
|-------|--------------|--------|
| 0 | Base environment, repo, AWS profile | ✅ Done |
| 1 | AWS core infrastructure | 🚧 In progress |
| 2 | Backend API MVP | ⏳ Pending |
| 3 | Runner service | ⏳ Pending |
| 4 | Frontend web | ⏳ Pending |
| 5 | Security & monitoring | ⏳ Pending |
| 6 | Integration & testing | ⏳ Pending |
| 7 | Documentation & final delivery | ⏳ Pending |

---

## 🗓️ Timeline (Suggested)
| Week | Milestone | Focus |
|------|------------|-------|
| Week 1–2 | Environment + AWS infra | S3, ECR, RDS, ECS setup |
| Week 3–4 | Backend MVP | Auth, upload, SQS integration |
| Week 5–6 | Runner + feedback | Test execution pipeline |
| Week 7 | Frontend + testing | UI, API integration, bug fixes |
| Week 8 | Final review & report | Docs, video, delivery |

---

## 🗓️ Weekly Plan – Delivery Target: 15 December 2025

| Week | Dates | Focus / Objective | Key Deliverables |
|------|--------|------------------|------------------|
| **Week 1** | **Nov 8 – Nov 14** | 🔧 *Infrastructure setup & API foundation* | - Create ECR, RDS, SQS, SES, ECS cluster (Issues #8–#12)  <br> - Initialize NestJS API project  <br> - Implement passwordless login (SES magic link)  <br> - Enable ZIP upload (S3 presigned URLs) |
| **Week 2** | **Nov 15 – Nov 21** | ⚙️ *Runner service MVP & integration with API* | - Build `runner` service (SQS → JUnit tests → S3 results)  <br> - Push images to ECR  <br> - End-to-end flow working (API → SQS → Runner → S3 → RDS) |
| **Week 3** | **Nov 22 – Nov 28** | 💻 *Frontend MVP + ECS deployment* | - Initialize Angular frontend (`web/`)  <br> - Implement login + upload + feedback views  <br> - Deploy API on ECS Fargate with ALB (HTTPS optional) |
| **Week 4** | **Nov 29 – Dec 8** | 🔒 *Security, monitoring, documentation* | - Configure IAM least privilege + Secrets Manager  <br> - Enable CloudWatch logs & metrics  <br> - Update `setup.md`, `architecture.md`, `README.md`  <br> - Test resiliency & handle edge cases |
| **Week 5** | **Dec 9 – Dec 15** | 🧩 *Final testing & TFM submission* | - Full demo test (student → submission → feedback)  <br> - Record presentation video  <br> - Write and format TFM report (PDF)  <br> - Final delivery via UOC Campus (GitHub link + PDF) |
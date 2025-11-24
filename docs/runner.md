# Runner Service Documentation

**Service:** Runner
**Purpose:** Asynchronous submission processing service
**Location:** `/runner`
**Deployment:** AWS ECS Fargate

---

## 1. Overview

The Runner service is a standalone microservice responsible for processing student code submissions asynchronously. It operates independently from the API service and runs as its own ECS Fargate task.

**Core Responsibilities:**
- Poll SQS queue for submission jobs
- Download submission ZIP files from S3
- Extract and prepare execution workspace
- Execute tests in isolated environment
- Capture and parse results
- Upload logs and feedback to S3
- Update submission status in PostgreSQL

---

## 2. Architecture

```
[SQS Queue] ──> [Runner Service]
                      │
                      ├──> [S3: Download ZIP]
                      │
                      ├──> [Execute Tests]
                      │
                      ├──> [S3: Upload Logs]
                      │
                      └──> [RDS: Update Status]
```

---

## 3. Project Structure

```
runner/
├── src/
│   └── index.ts              # Entry point
├── pits/                     # PIT configurations (RUN-6)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
└── README.md                 # Service-specific readme
```

---

## 4. Environment Variables

All required environment variables are defined in `.env.example`:

### AWS Configuration
- `AWS_REGION` - AWS region (eu-south-2)
- `AWS_S3_BUCKET` - S3 bucket name
- `AWS_SQS_QUEUE_URL` - Full SQS queue URL

### Database Configuration
- `DATABASE_URL` - PostgreSQL connection string (preferred)
- Or individual variables: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`

### Runner Configuration
- `RUNNER_POLL_INTERVAL_MS` - SQS polling interval (default: 20000)
- `RUNNER_TIMEOUT_MS` - Maximum execution time per submission (default: 120000)
- `RUNNER_MAX_LOG_BYTES` - Maximum log size in bytes (default: 200000)

### Build Tools
- `JDK_VERSION` - Java version (default: 17)
- `BUILD_TOOL` - Build tool to use (maven/gradle)

---

## 5. Running the Service

### Local Development

1. Install dependencies:
   ```bash
   cd runner
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the service:
   ```bash
   npm run start
   ```

   Or for development with auto-reload:
   ```bash
   npm run start:dev
   ```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled service
- `npm run start:dev` - Run with ts-node (development)
- `npm run lint` - Lint and fix code
- `npm run test` - Run tests

### Configuration Validation

The runner performs **fail-fast validation** on startup. If any required environment variable is missing, the service will:
1. Display a clear error message listing the missing variables
2. Exit with code 1
3. Prevent the service from starting in an invalid state

**Example error output:**
```
✗ Configuration validation failed:
Missing required environment variables:
  - AWS_SQS_QUEUE_URL
  - DATABASE_URL or (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME)

Please check your .env file or environment configuration.
```

**Successful startup output:**
```
🚀 Runner Service starting...

✓ Configuration loaded successfully

📋 Configuration:
  AWS Region: eu-south-2
  S3 Bucket: uoc-tfm-eval-platform
  SQS Queue: https://sqs.eu-south-2.amazonaws.com/...
  Poll Interval: 20000ms
  Execution Timeout: 120000ms
  Max Log Size: 200000 bytes
  JDK Version: 17
  Build Tool: maven

✓ Runner initialization complete
```

---

## 6. Dependencies

### Production Dependencies
- `@aws-sdk/client-s3` - S3 operations (download/upload)
- `@aws-sdk/client-sqs` - SQS queue operations
- `pg` - PostgreSQL client
- `dotenv` - Environment variable loader

### Development Dependencies
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution for development
- `rimraf` - Cross-platform file deletion
- `eslint` - Code linting
- `jest` - Testing framework

---

## 7. Implementation Progress

### ✅ RUN-1: Initialize Runner Service Project
**Status:** Completed
**Deliverables:**
- Created `runner/` folder structure
- Initialized `package.json` with all required scripts
- Configured `tsconfig.json` for TypeScript
- Added all dependencies (@aws-sdk/client-sqs, @aws-sdk/client-s3, pg, dotenv, rimraf)
- Created `src/index.ts` with bootstrap log
- Updated `.env.example` with all required variables
- Service starts locally with `npm run start`
- Compiles without TypeScript errors

---

### ✅ RUN-2: Configure Environment Variables & Shared Settings
**Status:** Completed
**Deliverables:**
- Created `src/config.ts` module for environment variable validation
- Validates all required variables on startup (fails fast if missing)
- Supports both `DATABASE_URL` and individual DB connection variables
- Updated `src/index.ts` to use configuration module
- Configuration logged on startup (without sensitive data)
- Service exits with error code 1 if required variables are missing

---

### ⏳ RUN-3: Implement SQS Polling Consumer
**Status:** Pending

---

### ⏳ RUN-4: Download Submission ZIP From S3
**Status:** Pending

---

### ⏳ RUN-5: Extract ZIP and Create Execution Workspace
**Status:** Pending

---

### ⏳ RUN-6: Load PIT Runner Configuration
**Status:** Pending

---

### ⏳ RUN-7: Execute Tests and Capture Output
**Status:** Pending

---

### ⏳ RUN-8: Upload Execution Logs to S3
**Status:** Pending

---

### ⏳ RUN-9: Update Submission Result in PostgreSQL
**Status:** Pending

---

### ⏳ RUN-10: Error Handling and Retry Strategy
**Status:** Pending

---

### ⏳ RUN-11: Dockerize Runner and Deploy to ECS
**Status:** Pending

---

## 8. Security Considerations

- Non-root user execution in Docker container
- Isolated execution environment per submission
- Resource limits (CPU, memory, timeout)
- Limited filesystem access
- Optional network isolation
- Secrets managed via AWS Secrets Manager

---

## 9. Observability

### Logging
- CloudWatch Logs integration
- Structured logging with submission context
- Error stack traces included

### Metrics (Future)
- Processing time per submission
- Success/failure rates
- Queue depth monitoring
- Resource utilization

---

## 10. Future Enhancements

- Multi-language support (Python, JavaScript, etc.)
- Static code analysis integration
- Plagiarism detection
- Advanced scoring algorithms
- Parallel test execution
- Custom test harness configurations

---

**Last Updated:** 2025-11-23
**Version:** 1.0.0-alpha

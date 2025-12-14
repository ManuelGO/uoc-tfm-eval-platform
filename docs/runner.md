# Runner Service Documentation

**Service:** Runner
**Purpose:** Asynchronous submission processing service
**Location:** `/runner`
**Deployment:** AWS ECS Fargate
**Status:** ✅ Production Ready

---

## 1. Overview

The Runner service is a standalone microservice responsible for processing student code submissions asynchronously. It operates independently from the API service and runs as its own ECS Fargate task.

**Core Responsibilities:**
- Poll SQS queue for submission jobs (long-polling)
- Download submission ZIP files from S3
- Extract and prepare isolated execution workspace
- Load PIT-specific configurations
- Execute tests with timeout controls
- Capture stdout/stderr and parse results
- Upload execution logs to S3
- Update submission status in PostgreSQL
- Handle errors gracefully without losing submissions

---

## 2. Architecture

```
┌─────────────┐
│  API Service│──┐
└─────────────┘  │
                 ├──> [SQS Queue] ──> [Runner Service]
┌─────────────┐  │                          │
│   Student   │──┘                          │
└─────────────┘                             │
                                            ├──> [S3: Download ZIP]
                                            │
                                            ├──> [Extract to Workspace]
                                            │
                                            ├──> [Load PIT Config]
                                            │
                                            ├──> [Execute Tests]
                                            │
                                            ├──> [S3: Upload Logs]
                                            │
                                            └──> [RDS: Update Status]
```

### Message Flow

1. **Student uploads code** → API creates submission record
2. **API uploads ZIP to S3** → Returns pre-signed URL
3. **API enqueues message** → SQS receives submission metadata
4. **Runner polls SQS** → Long-polling (20s wait time)
5. **Runner processes** → Full pipeline execution
6. **Status updated** → Database reflects DONE/ERROR status
7. **Logs available** → Student can view feedback

---

## 3. Project Structure

```
runner/
├── src/
│   ├── main.ts                      # Entry point with graceful shutdown
│   ├── config/
│   │   └── config.ts                # Environment validation
│   ├── queue/
│   │   ├── interfaces/
│   │   │   └── submission-message.interface.ts
│   │   └── sqs-consumer.service.ts  # SQS long-polling consumer
│   ├── storage/
│   │   └── s3-storage.service.ts    # S3 download/upload operations
│   ├── workspace/
│   │   └── workspace.service.ts     # ZIP extraction & workspace mgmt
│   ├── pit-config/
│   │   ├── interfaces/
│   │   │   └── pit-config.interface.ts
│   │   └── pit-config.service.ts    # PIT configuration loader
│   ├── executor/
│   │   ├── interfaces/
│   │   │   └── execution-result.interface.ts
│   │   └── executor.service.ts      # Test execution engine
│   ├── database/
│   │   └── database.service.ts      # PostgreSQL operations
│   └── processing/
│       └── processing.service.ts    # Pipeline orchestrator
├── pits/
│   └── sample-pit.json              # Example PIT configuration
│                                    # (PIT config docs: see Section 7)
├── Dockerfile                       # Multi-stage Docker build
├── .dockerignore                    # Docker ignore rules
├── ECS-DEPLOYMENT.md                # Deployment guide
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── eslint.config.js                 # Linting rules
└── .env.example                     # Environment variables template
```

---

## 4. Services Overview

### Main Entry Point (`main.ts`)
- Bootstraps all services
- Configures graceful shutdown (SIGTERM/SIGINT)
- Connects ProcessingService to SQS Consumer

### Queue Module (RUN-3)
**SqsConsumerService**
- Long-polling with 20s wait time
- Processes up to 10 messages simultaneously
- 5-minute visibility timeout
- Automatic message deletion after success
- Error isolation (failures don't stop the loop)

### Storage Module (RUN-4 + RUN-8)
**S3StorageService**
- `downloadZipToTemp()` - Downloads submission ZIPs from S3
- `uploadLogs()` - Uploads execution logs with size limits
- Configurable log truncation for cost/security
- Path prefixes as constants (`SUBMISSIONS_PREFIX`, `LOGS_PREFIX`)

### Workspace Module (RUN-5)
**WorkspaceService**
- `extractZip()` - Safe ZIP extraction with slip protection
- `cleanWorkspace()` - Automatic cleanup
- `isPathSafe()` - Path traversal validation
- Isolated workspace: `./work/<submissionId>/`
- Uses `extract-zip` library for security

### PIT Config Module (RUN-6)
**PitConfigService**
- `loadConfig(pitId)` - Loads PIT-specific configuration
- Configuration caching for performance
- Validation of required fields
- Supports: language, buildTool, testCommand, maxTimeoutMs
- Optional: setupCommands, environment, requiredFiles

### Executor Module (RUN-7)
**ExecutorService**
- `executeTests()` - Runs test commands in workspace
- Timeout enforcement with progressive kill (SIGTERM → SIGKILL)
- Captures stdout/stderr in real-time
- Parses test results (MVP: exit code based)
- Score calculation (MVP: binary 0/100)
- Returns standardized `ExecutionResult`

### Database Module (RUN-9)
**DatabaseService**
- `updateSubmissionResult()` - Updates submission in PostgreSQL
- Connection pooling with pg Pool
- Handles nullable feedback/logsS3Key
- Type-safe status enum
- `testConnection()` - Health check
- `close()` - Graceful shutdown

### Processing Module (RUN-10)
**ProcessingService**
- Orchestrates complete 6-step pipeline
- Try/catch around each critical step
- Error handling strategy (MVP):
  - Mark submission as ERROR in DB
  - Upload error logs to S3
  - Allow SQS message deletion (no retry)
  - Continue processing other messages
- Detailed logging with stack traces
- Automatic workspace cleanup (finally block)
- Runtime isolation

---

## 5. Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `eu-south-2` |
| `AWS_S3_BUCKET` | S3 bucket for submissions | `uoc-tfm-eval-platform` |
| `AWS_SQS_QUEUE_URL` | SQS queue URL | `https://sqs.eu-south-2.amazonaws.com/...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

**Alternative Database Configuration:**
```
DB_HOST=tfmdb.xxx.eu-south-2.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=secret
DB_NAME=tfmdb
```

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUNNER_POLL_INTERVAL_MS` | SQS polling interval | `20000` |
| `RUNNER_TIMEOUT_MS` | Test execution timeout | `120000` |
| `RUNNER_MAX_LOG_BYTES` | Maximum log size | `200000` |
| `JDK_VERSION` | Java version | `17` |
| `BUILD_TOOL` | Build tool (maven/gradle) | `maven` |

---

## 6. Running the Service

### Local Development

1. **Install dependencies:**
   ```bash
   cd runner
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start the service:**
   ```bash
   npm run start
   ```

   Or for development with auto-reload:
   ```bash
   npm run start:dev
   ```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run compiled service (`node dist/main.js`)
- `npm run start:dev` - Run with ts-node (development)
- `npm run lint` - Lint and fix code with ESLint
- `npm run test` - Run Jest tests

### Configuration Validation

The runner performs **fail-fast validation** on startup:

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

📦 Initializing services...
[ProcessingService] Initialized all services
[DatabaseService] Database pool initialized

🔄 Starting SQS Consumer...
   Queue: https://sqs...
   Max Messages: 10
   Wait Time: 20s (long-polling enabled)
   Visibility Timeout: 300s

✓ Runner initialization complete
👀 Listening for submissions...
```

---

## 7. PIT Configuration Files

The runner uses JSON configuration files (PITs) to define how submissions
are executed and evaluated.

Each PIT configuration specifies:
- Language
- Build tool
- Test command
- Timeout
- Optional setup and environment variables

### Configuration Format

Each PIT has its own JSON configuration file named `{pitId}.json`.

#### Required Fields

- **language**: Programming language (e.g., "java", "python", "javascript")
- **buildTool**: Build tool or package manager (e.g., "maven", "gradle", "npm")
- **testCommand**: Command to execute tests
- **maxTimeoutMs**: Maximum execution timeout in milliseconds

#### Optional Fields

- **setupCommands**: Array of commands to run before test execution (e.g., dependency installation)
- **environment**: Environment variables to set during execution
- **requiredFiles**: Files or directories that must be present in the submission

### Example Configuration

```json
{
  "language": "java",
  "buildTool": "maven",
  "testCommand": "mvn -q test",
  "maxTimeoutMs": 60000,
  "setupCommands": [
    "mvn -q clean compile"
  ],
  "environment": {
    "JAVA_HOME": "/usr/lib/jvm/java-17-openjdk"
  },
  "requiredFiles": [
    "pom.xml",
    "src/"
  ]
}
```

### Available Configurations

- **sample-pit.json**: Java Maven project with JUnit tests

### Adding New PITs

1. Create a new JSON file with the PIT ID as filename (e.g., `python-unittest.json`)
2. Define all required fields according to the PIT's requirements
3. Test the configuration by running a sample submission
4. Document any specific requirements or dependencies

### Configuration Notes

- Configuration files are loaded and validated at runtime
- Invalid configurations will prevent submission processing
- Configurations are cached after first load for performance

---

## 8. Processing Pipeline

### Complete 6-Step Pipeline

```
============================================================
[ProcessingService] Starting pipeline for submission: xxx
============================================================

[Step 1/6] Downloading ZIP from S3...
✓ ZIP downloaded: ./tmp/xxx/submission.zip

[Step 2/6] Extracting ZIP to workspace...
✓ ZIP extracted to: ./work/xxx

[Step 3/6] Loading PIT configuration...
✓ PIT config loaded: java/maven

[Step 4/6] Executing tests...
✓ Tests executed: DONE (score: 100)

[Step 5/6] Uploading logs to S3...
✓ Logs uploaded: logs/xxx/run.log

[Step 6/6] Updating database...
✓ Database updated successfully

============================================================
✅ Pipeline completed successfully for: xxx
   Status: DONE
   Score: 100
============================================================

🧹 Workspace cleaned: xxx
```

### Error Handling

```
============================================================
❌ Pipeline failed for submission: xxx
============================================================
Error: Failed to execute tests: Command timeout
Stack trace:
Error: Failed to execute tests: Command timeout
    at ProcessingService.processSubmission (...)
    ...

✓ Error logs uploaded: logs/xxx/run.log
✓ Database updated with ERROR status

============================================================
⚠️  Pipeline failed but runner continues
============================================================
```

---

## 9. Deployment

### Docker

**Dockerfile Features:**
- Multi-stage build (builder + runtime)
- Node.js 18 Alpine base
- OpenJDK 17 + Maven for test execution
- Non-root user (UID 1001)
- Production-only dependencies
- Health check included

**Build and run:**
```bash
# Build
docker build -t uoc-tfm/runner:latest .

# Run
docker run --env-file .env uoc-tfm/runner:latest
```

### AWS ECS Fargate

See [ECS-DEPLOYMENT.md](../runner/ECS-DEPLOYMENT.md) for complete deployment guide.

**CI/CD Pipeline:**
The runner uses GitHub Actions (`.github/workflows/ecr-push.yml`) for automated deployment:

```
Code Push → GitHub Actions → ECR → ECS Fargate
```

**Automatic Deployment:**
1. Push changes to `main` branch with changes in `runner/**`
2. GitHub Actions workflow triggers automatically:
   - Validates AWS credentials
   - Builds Docker image (multi-stage, linux/amd64)
   - Pushes to ECR: `uoc-tfm/runner:latest`
   - Forces ECS service redeployment
3. ECS performs rolling update with zero downtime
4. New tasks start running with latest code

**Required GitHub Secrets:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`, `ECR_ACCOUNT_ID`

**Required GitHub Variables:**
- `ECS_CLUSTER`, `ECS_WORKER_SERVICE`

**Manual Deployment:**
```bash
# Build and push manually
cd runner
docker build -t uoc-tfm/runner:latest .
docker tag uoc-tfm/runner:latest $ECR_RUNNER:latest
docker push $ECR_RUNNER:latest

# Force ECS redeployment
aws ecs update-service \
  --cluster $CLUSTER \
  --service $WORKER_SERVICE \
  --force-new-deployment
```

**CloudWatch Logs:**
```bash
aws logs tail /ecs/uoc-tfm-runner --follow
```

---

## 10. Dependencies

### Production Dependencies
- `@aws-sdk/client-s3@^3.932.0` - S3 operations
- `@aws-sdk/client-sqs@^3.935.0` - SQS operations
- `pg@^8.16.3` - PostgreSQL client
- `dotenv@^16.4.5` - Environment variables
- `extract-zip@^2.0.1` - Safe ZIP extraction

### Development Dependencies
- `typescript@^5.7.3` - TypeScript compiler
- `ts-node@^10.9.2` - TypeScript execution
- `eslint@^9.18.0` - Code linting
- `typescript-eslint@^8.48.0` - TypeScript ESLint rules
- `jest@^30.0.0` - Testing framework
- `rimraf@^6.0.1` - Cross-platform cleanup

---

## 11. Implementation Status

### ✅ RUN-1: Initialize Runner Service Project
**Status:** ✅ Completed
**Deliverables:**
- Project structure created
- Package.json with all scripts
- TypeScript configuration
- Dependencies installed
- Basic entry point

### ✅ RUN-2: Configure Environment Variables
**Status:** ✅ Completed
**Deliverables:**
- Config module with validation
- Fail-fast error handling
- .env.example template
- Database config support

### ✅ RUN-3: Implement SQS Polling Consumer
**Status:** ✅ Completed
**Deliverables:**
- SqsConsumerService with long-polling
- Message parsing and validation
- Error isolation
- Logging with context

### ✅ RUN-4: Download Submission ZIP From S3
**Status:** ✅ Completed
**Deliverables:**
- S3StorageService.downloadZipToTemp()
- Stream-based download
- Directory creation
- Error handling

### ✅ RUN-5: Extract ZIP and Create Workspace
**Status:** ✅ Completed
**Deliverables:**
- WorkspaceService.extractZip()
- ZIP Slip protection
- Workspace isolation
- Automatic cleanup

### ✅ RUN-6: Load PIT Runner Configuration
**Status:** ✅ Completed
**Deliverables:**
- PitConfigService with caching
- JSON configuration format
- Field validation
- sample-pit.json example

### ✅ RUN-7: Execute Tests and Capture Output
**Status:** ✅ Completed
**Deliverables:**
- ExecutorService.executeTests()
- Timeout handling
- stdout/stderr capture
- Result transformation

### ✅ RUN-8: Upload Execution Logs to S3
**Status:** ✅ Completed
**Deliverables:**
- S3StorageService.uploadLogs()
- Log size truncation
- S3 key return for DB
- Path constants

### ✅ RUN-9: Update Submission Result in PostgreSQL
**Status:** ✅ Completed
**Deliverables:**
- DatabaseService with pg Pool
- updateSubmissionResult()
- Optional feedback/logsS3Key
- Connection management

### ✅ RUN-10: Error Handling and Retry Strategy
**Status:** ✅ Completed
**Deliverables:**
- ProcessingService orchestrator
- Try/catch on all steps
- Error logs generation
- Pipeline isolation
- Workspace cleanup

### ✅ RUN-11: Dockerize Runner and Deploy to ECS
**Status:** ✅ Completed
**Deliverables:**
- Multi-stage Dockerfile with tini init system
- Non-root user (UID 1001)
- OpenJDK 17 + Maven runtime
- .dockerignore optimized for build
- Health check configuration
- ECS task definition documentation

### ✅ RUN-12: GitHub Actions CI/CD Pipeline
**Status:** ✅ Completed
**Deliverables:**
- Automated ECR build and push workflow
- Multi-platform build support (linux/amd64)
- ECS automatic redeployment on merge to main
- Secrets and variables configuration
- Path-based triggering (runner/**)
- Build validation and error handling
- CloudWatch Logs integration
- Complete deployment documentation

---

## 12. Security Considerations

- ✅ Non-root user in Docker (UID 1001)
- ✅ Isolated workspace per submission
- ✅ ZIP Slip attack protection
- ✅ Resource limits (timeout, log size)
- ✅ Connection string not logged in application logs
- ✅ Environment variables via ECS task definition
- ✅ RDS access restricted by VPC security groups
- ✅ Path traversal validation
- ✅ Progressive process termination (SIGTERM → SIGKILL)
- ✅ Tini init system for proper signal handling
- ⚠️  Future: Consider AWS Secrets Manager for DATABASE_URL

---

## 13. Monitoring & Observability

### Logging
- CloudWatch Logs integration
- Structured logging with submission IDs
- Complete stack traces on errors
- Step-by-step pipeline progress

### Key Log Patterns

**Startup:**
```
🚀 Runner Service starting...
✓ Configuration loaded successfully
✓ Runner initialization complete
👀 Listening for submissions...
```

**Processing:**
```
📨 Received 2 message(s) from SQS
🔧 Processing submission: xxx
[Step 1/6] Downloading ZIP from S3...
✓ ZIP downloaded
...
✅ Pipeline completed successfully
```

**Errors:**
```
❌ Pipeline failed for submission: xxx
Error: Failed to load PIT config: File not found
Stack trace: ...
✓ Database updated with ERROR status
```

### Health Checks
- Container health check via ps command
- Database connection test method
- SQS polling activity in logs

---

## 14. Scaling & Performance

### Current Configuration
- **Max messages per poll:** 10
- **Long-polling wait:** 20 seconds
- **Visibility timeout:** 5 minutes
- **Concurrent processing:** Up to 10 submissions

### Scaling Strategies

**Horizontal Scaling:**
```bash
aws ecs update-service \
  --cluster your-cluster \
  --service uoc-tfm-worker-service \
  --desired-count 3
```

**Auto-scaling** (based on SQS queue depth):
- Scale out when `ApproximateNumberOfMessagesVisible > 10`
- Scale in when queue is empty

**Cost Optimization:**
- Fargate Spot instances
- Scheduled scaling (off-hours)
- Right-size CPU/memory based on metrics

---

## 15. Future Enhancements

- [ ] Multi-language support (Python, JavaScript, C++)
- [ ] Advanced test result parsing (JUnit XML, TAP)
- [ ] Proportional scoring based on pass rate
- [ ] Static code analysis integration
- [ ] Plagiarism detection
- [ ] Custom sandbox environments
- [ ] Metrics and dashboards (CloudWatch)
- [ ] Dead Letter Queue for failed messages
- [ ] Retry with exponential backoff

---

## 16. Troubleshooting

### Common Issues

**Container won't start:**
- Check CloudWatch logs
- Verify environment variables
- Check IAM permissions

**SQS messages not processed:**
- Verify SQS queue URL
- Check IAM permissions for SQS
- Ensure runner is polling (check logs)

**Database connection errors:**
- Verify DATABASE_URL
- Check security groups
- Verify RDS accessibility

**S3 access errors:**
- Check IAM permissions
- Verify bucket name
- Check object existence

**Test execution failures:**
- Check PIT configuration
- Verify JDK/Maven installation
- Review execution logs in S3

---

**Last Updated:** 2025-11-25
**Version:** 1.0.0
**Status:** ✅ Production Ready

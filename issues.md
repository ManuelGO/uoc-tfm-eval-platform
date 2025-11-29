# Runner Service Issues

## RUN-1 — Initialize Runner Service Project

### Description
Create the foundation of the Runner microservice responsible for processing submissions asynchronously.
This service will run independently from the API and will be deployed as its own ECS Fargate task.

### Tasks
- Create folder `runner/` at repository root.
- Initialize `package.json` with scripts:
  - `build`
  - `start`
  - `lint`
  - `test`
- Create base TypeScript configuration (`tsconfig.json`).
- Add dependencies:
  - `@aws-sdk/client-sqs`
  - `@aws-sdk/client-s3`
  - `pg`
  - `dotenv`
  - `rimraf`
- Add `src/index.ts` with a minimal bootstrap log ("Runner started").
- Add `.env.example` referencing required environment variables.

### Acceptance Criteria
- Runner starts locally with `npm run start`.
- Compiles without TS errors.
- Project structure matches the API microservice style.

---

## RUN-2 — Configure Environment Variables & Shared Settings

### Description
Define all required environment variables for the runner and keep consistent naming with the API.

### Tasks
- Add variables to `.env.example`:
  - `AWS_REGION`
  - `AWS_SQS_QUEUE_URL`
  - `AWS_S3_BUCKET`
  - `DATABASE_URL` or individual DB connection variables
  - `RUNNER_POLL_INTERVAL_MS`
- Add environment loader module (`config.ts`) that validates presence of required variables.
- Document runner boot instructions inside `backend.md`.

### Acceptance Criteria
- Running `npm start` fails fast if required variables are missing.
- Documentation updated.

---

## RUN-3 — Implement SQS Polling Consumer

### Description
Implement an SQS long-polling loop that continuously receives submission messages from the `submissions-queue`.

### Tasks
- Create `SqsConsumer` class responsible for:
  - Long polling (`WaitTimeSeconds = 20`)
  - Handling up to N messages at a time
  - Parsing message bodies
- On message reception:
  - Parse the `submissionId`, `fileKey`, `userId`, `pitId`, `createdAt`
  - Pass it to the processing pipeline
- Implement message deletion after successful processing.
- Log all message events with `submissionId` context.

### Acceptance Criteria
- Runner receives messages from SQS.
- Logs show incoming messages and deletions.
- Errors do not crash the polling loop.

---

## RUN-4 — Download Submission ZIP From S3

### Description
Given a `fileKey`, download the submission ZIP file from S3 into a local temporary working directory.

### Tasks
- Implement `StorageService` using `@aws-sdk/client-s3`.
- Implement method `downloadZipToTemp(fileKey): Promise<string>` returning the local file path.
- Write files under a structure like:
  ```
  ./tmp/<submissionId>/submission.zip
  ```
- Ensure directory creation and cleanup.
- Add error handling for missing keys or access issues.

### Acceptance Criteria
- ZIP files downloaded reliably from S3.
- Local temp directory created per submission.
- Errors logged with enough context.

---

## RUN-5 — Extract ZIP and Create Execution Workspace

### Description
Unzip the student ZIP into an isolated workspace that will later be used for compilation and test execution.

### Tasks
- Implement `extractZip(zipPath, destinationFolder)` using a safe ZIP extraction library.
- Workspace folder structure:
  ```
  ./work/<submissionId>/
  ```
- Protect against ZIP Slip attacks.
- Remove previous workspace directories if they exist.

### Acceptance Criteria
- ZIP extracted into workspace.
- No files escape the workspace directory.
- Workspace contains exactly the files from the ZIP.

---

## RUN-6 — Load PIT Runner Configuration

### Description
Each PIT may require different runtime configuration (runtime, test command, timeouts, etc.).
The runner must load a configuration file for each PIT.

### Tasks
- Create folder `runner/pits/`.
- Define configuration file format, e.g.:
  ```json
  {
    "language": "java",
    "buildTool": "maven",
    "testCommand": "mvn -q test",
    "maxTimeoutMs": 60000
  }
  ```
- Implement `PitConfigService`:
  - Locates config based on `pitId`
  - Validates fields
- For now, allow one PIT config for MVP (e.g. the sample PIT).

### Acceptance Criteria
- Runner loads PIT configs without errors.
- Missing or invalid configs produce clear log messages.

---

## RUN-7 — Execute Tests and Capture Output

### Description
Execute the test command inside the workspace and convert the result into standardized runner output.

### Tasks
- Use `child_process.spawn` or `exec` to run the PIT's `testCommand`.
- Capture:
  - `exitCode`
  - `stdout`
  - `stderr`
- Apply timeout using `maxTimeoutMs`.
- Transform execution results to:
  ```json
  {
    "status": "DONE" | "ERROR",
    "score": number,
    "feedback": { /* test results summary */ },
    "logs": "<raw logs>"
  }
  ```
- For MVP, simulated scoring is acceptable if a real test harness isn't implemented yet.

### Acceptance Criteria
- Commands execute successfully in the workspace.
- Runner captures stdout/stderr.
- Structured output generated.

---

## RUN-8 — Upload Execution Logs to S3

### Description
Store full execution logs (stdout + stderr) in S3 for later retrieval by the frontend.

### Tasks
- Create `uploadLogs(submissionId, logs): Promise<string>` method.
- Store logs under:
  ```
  logs/<submissionId>/run.log
  ```
- Return the S3 key to use during DB update.

### Acceptance Criteria
- Log file appears in S3.
- Returned `logsS3Key` is valid and matches stored content.

---

## RUN-9 — Update Submission Result in PostgreSQL

### Description
Update the submission row in RDS with runner results, making them available to the API `/feedback` endpoint.

### Tasks
- Implement lightweight PostgreSQL client (`pg`).
- Implement:
  ```typescript
  updateSubmissionResult(submissionId, {
    status,
    score,
    feedback,
    logsS3Key
  })
  ```
- Ensure `feedback` is stored as JSONB.
- Store timestamps like `updatedAt`.

### Acceptance Criteria
- Database update succeeds.
- API `/feedback/:submissionId` shows updated results.
- Errors handled without crashing runner.

---

## RUN-10 — Error Handling and Retry Strategy

### Description
Ensure the runner is robust to failures without losing submissions.

### Tasks
- Add try/catch around all critical process steps.
- Define behavior for failure:
  - Option A (MVP): Mark submission as ERROR and delete SQS message.
  - Option B: Leave message un-deleted for SQS retry (configurable later).
- Add detailed logs including stack traces.
- Implement runtime isolation so one failure does not stop the loop.

### Acceptance Criteria
- Runner continues running after processing errors.
- Submissions always end with a final status (DONE or ERROR).
- SQS messages do not get stuck indefinitely.

---

## RUN-11 — Dockerize Runner and Deploy to ECS

### Description
Package the runner into a container image and deploy it to AWS ECS.

### Tasks
- Create `runner/Dockerfile`:
  - Multi-stage build
  - Install dependencies
  - Copy PIT configs
  - Use non-root user in final image
- Add runner image to GitHub Actions ECR pipeline.
- Update ECS worker-service task definition to use new image.
- Configure environment variables in ECS.
- Validate:
  - Container starts
  - Polls SQS
  - Processes messages end-to-end

### Acceptance Criteria
- Runner deployed and running inside ECS Fargate.
- Logs visible in CloudWatch.
- Submissions processed automatically after upload.
## RUN-12 — GitHub Actions CI/CD pipeline for Runner (ECR + ECS)

### 🔎 Summary

Create or update a GitHub Actions workflow that:

1. Builds the **Runner** Docker image from `/runner`.
2. Pushes the image to **Amazon ECR** (`uoc-tfm/runner`).
3. Triggers a redeploy of the **ECS worker service** (`worker-service`) in the existing cluster (`uoc-tfm-cluster`).
4. Integrates cleanly with the **existing CI/CD setup** already used for the API.

The goal is to have a fully automated path from push → image build → ECR push → ECS Fargate update for the Runner service.

---

### 📁 Repository Context

- Repo: `uoc-tfm-eval-platform`
- Runner code: `/runner`
- Dockerfile: `/runner/Dockerfile`
- Existing infrastructure:
  - ECR repositories:
    - `451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/api`
    - `451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner`
  - ECS cluster: `uoc-tfm-cluster`
  - ECS services:
    - API: `api-service`
    - Runner: `worker-service`
  - Region: `eu-south-2`
- There is already a workflow for API/ECR (e.g. `.github/workflows/ecr-push.yml`).  
  The new Runner pipeline should **reuse** as much of that logic as possible.

---

### 🔐 Required GitHub configuration

Make sure these are configured in the repo:

#### Secrets (Settings → Secrets and variables → Actions → Secrets)

- `AWS_ACCESS_KEY_ID` — IAM user key with ECR + ECS permissions
- `AWS_SECRET_ACCESS_KEY` — IAM user secret
- `AWS_REGION` — `eu-south-2`
- `ECR_ACCOUNT_ID` — `451747690955`

#### Variables (Settings → Secrets and variables → Actions → Variables)

- `ECS_CLUSTER` — `uoc-tfm-cluster`
- `ECS_API_SERVICE` — `api-service` (already used by API pipeline)
- `ECS_WORKER_SERVICE` — `worker-service`

---

### 🧩 Requirements for the workflow

1. **Trigger conditions**
   - Workflow must run on:
     - `push` to `main`  
     - Optionally: `push` to any branch that touches `runner/**` or `pits/**`.
   - Optional: manual trigger via `workflow_dispatch`.

2. **Build & tag runner image**
   - Build the Docker image from `runner/` using the existing `Dockerfile`.
   - Use multi-platform build if needed (`linux/amd64`).
   - Tags:
     - `latest`
     - Git SHA (e.g. `${{ github.sha }}`)

   Example tags (for reference, not necessarily literal):
   - `451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:latest`
   - `451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:${{ github.sha }}`

3. **Login to ECR**
   - Use `aws-actions/configure-aws-credentials` to configure AWS.
   - Use `aws-actions/amazon-ecr-login` to log in to ECR.
   - Region must be `eu-south-2`.

4. **Push runner image to ECR**
   - Push **both tags** (`latest` and SHA) to the `uoc-tfm/runner` repo.
   - Make sure the repo name matches the existing ECR repository exactly.

5. **ECS redeploy for worker-service**
   - After push, call:
     - `aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_WORKER_SERVICE --force-new-deployment`
   - Use `AWS_REGION` and `ECS_*` values from GitHub **variables**, not hardcoded literals.
   - Redeploy only the **worker-service** in this workflow (the API service is handled by its own pipeline).

6. **Reuse common logic**
   - If there is an existing workflow for `api`:
     - Avoid copy-pasting large blocks if a shared job can be reused.
     - But simplicity is more important than over-abstracting; a separate job for Runner is acceptable as long as it is clear.

---

### ✅ Tasks

- [ ] Inspect existing workflow(s) under `.github/workflows/` (e.g. `ecr-push.yml`).
- [ ] Decide whether to:
  - [ ] Extend the existing ECR workflow to also handle Runner **or**
  - [ ] Create a new dedicated workflow file (e.g. `runner-ecr-deploy.yml`).
- [ ] Define `on:` triggers:
  - [ ] `push` to `main`  
  - [ ] `push` with `paths: ["runner/**", "pits/**", ".github/workflows/**"]` (optional but recommended)
  - [ ] `workflow_dispatch` for manual runs
- [ ] Add a job `build-and-push-runner` that:
  - [ ] Uses `ubuntu-latest` runner
  - [ ] Checks out the repository (`actions/checkout@v4`)
  - [ ] Uses `aws-actions/configure-aws-credentials@v4` with:
    - [ ] `aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}`
    - [ ] `aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}`
    - [ ] `aws-region: ${{ secrets.AWS_REGION }}` or a variable
  - [ ] Logs in to ECR via `aws-actions/amazon-ecr-login@v2`
  - [ ] Builds the Runner image from `./runner` with `docker build` or `docker buildx`:
    - [ ] Tag: `${{ secrets.ECR_ACCOUNT_ID }}.dkr.ecr.${{ vars.AWS_REGION || secrets.AWS_REGION }}.amazonaws.com/uoc-tfm/runner:latest`
    - [ ] Tag: same registry + `:${{ github.sha }}`
  - [ ] Pushes both tags to ECR
- [ ] Add a job step (or separate job) to redeploy ECS:
  - [ ] Use `aws ecs update-service` to redeploy the Runner:
    ```bash
    aws ecs update-service \
      --cluster "${{ vars.ECS_CLUSTER }}" \
      --service "${{ vars.ECS_WORKER_SERVICE }}" \
      --force-new-deployment \
      --region "${{ secrets.AWS_REGION }}"
    ```
  - [ ] Make sure this step runs only after the image push succeeds.

---

### 🧪 Testing & Validation

Manual test plan after pipeline is created:

1. **Dry run with workflow_dispatch**
   - Trigger the workflow manually from GitHub UI with `workflow_dispatch`.
   - Confirm:
     - The job logs show a successful login to ECR.
     - Docker image build completes.
     - Push to ECR succeeds.
     - ECS `update-service` call returns without error.

2. **Verify ECR image**
   - In AWS console:
     - Go to **ECR → Repositories → uoc-tfm/runner**
     - Confirm:
       - New `latest` image with recent timestamp.
       - Image tagged with current commit SHA.

3. **Verify ECS service update**
   - In AWS console:
     - Go to **ECS → Clusters → uoc-tfm-cluster → worker-service**
     - Confirm:
       - A new deployment has been created using the new image.
       - Tasks reach `RUNNING` and `HEALTHY` state.

4. **End-to-end functional test**
   - From the existing API:
     - Trigger a new submission (request upload → upload zip → confirm).
   - Confirm in:
     - CloudWatch logs for the Runner that:
       - The SQS message is processed.
       - Tests run in the workspace.
       - Logs are uploaded to S3.
       - The submission row in RDS gets updated (status: `DONE` or `ERROR`).
   - Use `/submissions/feedback/:id` endpoint in the API to verify:
     - `status`, `score`, `feedback`, `logsS3Key` reflect the runner output.

---

### ✅ Acceptance Criteria

- [ ] A GitHub Actions workflow exists for the Runner (either new file or extended existing one).
- [ ] On `push` to relevant paths, the workflow:
  - [ ] Builds the Runner Docker image successfully.
  - [ ] Pushes the image to `uoc-tfm/runner` ECR repository with tags `latest` and `${{ github.sha }}`.
  - [ ] Calls `aws ecs update-service` for `worker-service` with `--force-new-deployment`.
- [ ] After the workflow completes:
  - [ ] New tasks in the ECS `worker-service` use the new image.
  - [ ] Runner container starts successfully in ECS (no crash loop).
  - [ ] A new student submission triggers:
    - [ ] Runner pickup via SQS.
    - [ ] Execution + logs upload to S3.
    - [ ] Database update.
    - [ ] API `/submissions/feedback/:id` returns consistent data.
- [ ] All configuration values (AWS account, region, ECS names) are taken from **secrets/variables**, not hard-coded in the workflow.

---

## PITGEN-1 — Define PIT config templates and conventions

### Description

Define how PIT (Programming Interactive Task) configurations will be generated and stored so they can be consumed by the Runner service. This issue focuses on conventions and templates, not on implementation yet.

### Tasks
- Define the output location for PIT configs:
  - Use `runner/pits/<pitId>.json`.
- Base the JSON structure on the existing `PitConfig` interface in `runner/src/pit-config/interfaces/pit-config.interface.ts`:
  - `language: string`
  - `buildTool: string`
  - `testCommand: string`
  - `maxTimeoutMs: number`
  - `setupCommands?: string[]`
  - `environment?: Record<string, string>`
  - `requiredFiles?: string[]`
- Define supported values (for now) for:
  - `language` (e.g. "java", "python", "javascript")
  - `buildTool` (e.g. "maven", "gradle", "npm")
- Define a canonical PIT ID naming convention, for example:
  - `java-maven-bank-account-v1`
  - `java-maven-basic-oop-v1`
- Decide defaults for common scenarios (for Java/Maven MVP), for example:
  - `language: "java"`
  - `buildTool: "maven"`
  - `testCommand: "mvn -q test"`
  - `maxTimeoutMs: 60000`
- Document these conventions in a new file:
  - `runner/PIT-CONFIGS.md`

### Acceptance Criteria
- `runner/PIT-CONFIGS.md` exists and documents:
  - Where PIT configs live in the repo.
  - The JSON structure with an example.
  - Naming conventions for PIT IDs.
  - Default values for the Java/Maven PIT use case.
- The documented JSON structure is fully compatible with the existing `PitConfig` interface.
- The Runner can still load PIT configs from `runner/pits/<pitId>.json` without code changes.

---

## PITGEN-2 — Implement PIT config generator CLI (Node/TS)

### Description

Implement a small CLI tool in the runner project that generates valid PIT configuration files (.json) under `runner/pits/`. The tool should support both interactive mode (ask questions) and non-interactive mode (arguments/flags).

The goal: make it easy for a developer or instructor to create new PITs without manually crafting JSON.

### Tasks
- Create a new TypeScript module, e.g.:
  - `runner/src/tools/pit-generator.ts`
- Implement CLI entrypoint that can be run via:
  - `npm run generate:pit` (interactive)
  - `npm run generate:pit -- --id=... --language=... --buildTool=... --testCommand=...` (non-interactive)
- Use Node's `readline` (or similar) for interactive mode:
  - Prompt for:
    - `pitId` (mandatory)
    - `language` (suggest default, e.g. "java")
    - `buildTool` (suggest default "maven")
    - `testCommand` (suggest default "mvn -q test")
    - `maxTimeoutMs` (suggest default 60000)
    - Optionally:
      - `setupCommands` (comma-separated list, can be empty)
      - `requiredFiles` (comma-separated list, can be empty)
- Validate inputs:
  - `pitId` must be non-empty and filesystem-safe (no spaces, slashes, etc.).
  - `maxTimeoutMs` must be a positive integer.
  - `language` and `buildTool` should be either:
    - in a supported list, or
    - accepted with a warning if unknown.
- Build the `PitConfig` object in memory and reuse the existing interface for type safety.
- Write the JSON file to:
  - `runner/pits/<pitId>.json`
- If the file already exists:
  - Ask for confirmation in interactive mode (overwrite? yes/no).
  - In non-interactive mode:
    - Fail with a clear error (no overwrite by default).
- Add an npm script in `runner/package.json`:
  ```json
  "scripts": {
    "generate:pit": "ts-node src/tools/pit-generator.ts"
  }
  ```
- Log a short summary after generation:
  - PIT ID
  - Output path
  - Test command
  - Timeout

### Acceptance Criteria
- Running `npm run generate:pit` in the runner directory:
  - Prompts the user for fields.
  - Generates a valid JSON file in `runner/pits/<pitId>.json`.
- Running with flags (non-interactive), e.g.:
  ```bash
  npm run generate:pit -- \
    --id=java-maven-sample-v1 \
    --language=java \
    --buildTool=maven \
    --testCommand="mvn -q test" \
    --maxTimeoutMs=60000
  ```
  generates the same JSON without prompts.
- Generated file loads correctly via the existing `PitConfigService.loadConfig(pitId)` with no validation errors.
- If a PIT ID already exists, the tool behaves as specified (prompt or fail depending on mode).

---

## PITGEN-3 — Add sample PIT config and documentation for instructors

### Description

Provide a ready-to-use example PIT configuration and document how an instructor can create new exercises using the generator and connect them with the API.

This issue is about making the workflow understandable and demo-friendly.

### Tasks
- Use the CLI from PITGEN-2 to generate a sample PIT config:
  - ID: `java-maven-dummy-dev`
  - language: `java`
  - buildTool: `maven`
  - testCommand: `mvn -q test`
  - maxTimeoutMs: `60000`
- Ensure that:
  - The sample PIT ID matches the one used in your dev PIT entry in the API (e.g. "Dummy PIT for dev"), or update the dev PIT record to use the new ID.
- Verify end-to-end locally (optional but recommended):
  - Generate config.
  - Create a dummy submission ZIP with a valid `pom.xml` and tests.
  - Run the Runner locally against a test SQS message (or mock).
- Update documentation:
  - In `runner/PIT-CONFIGS.md` or a new `docs/` file, add:
    - "How to create a new PIT" step-by-step:
      1. Decide PIT ID and language/build tool.
      2. Run `npm run generate:pit`.
      3. Add tests/project structure in the PIT's template (if applicable).
      4. Register the PIT in the API (DB seed or admin flow).
      5. Use that PIT ID in `/submissions/confirm`.
    - Example for the sample PIT with concrete commands.
  - (Optional) Mention the generator in the main project `README.md` or a `docs/` index.

### Acceptance Criteria
- A sample PIT config JSON exists under `runner/pits/` and is known to work end-to-end with the current runner.
- There is clear documentation explaining:
  - How to generate a new PIT config.
  - How to link a PIT config to a PIT entry in the API.
  - How the Runner uses the `pitId` to find the corresponding config file.
- In your environment, a submission using the sample PIT can be processed to DONE with a score and feedback when tests pass.
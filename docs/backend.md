## 3. Database Models

The backend uses **PostgreSQL** with **TypeORM** (synchronized in development).  
Entities are automatically loaded using `autoLoadEntities: true`.

### 3.1 User Entity
Represents any authenticated user of the system.

**Fields**
- `id` (UUID)
- `email` (string, unique)
- `name` (string | null)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Relations**
- One-to-many with `Submission`  
  (`User` ↝ `Submissions`)

---

### 3.2 Pit (Assignment) Entity
Represents a “pozo de entrega” or assignment activated using a professor-provided code.

**Fields**
- `id` (UUID)
- `code` (string, unique)
- `title` (string)
- `isActive` (boolean)
- `createdAt`
- `updatedAt`

**Relations**
- One-to-many with `Submission`  
  (`Pit` ↝ `Submissions`)

---

### 3.3 Submission Entity
Represents a student’s code submission.

**Fields**
- `id` (UUID)
- `userId` (UUID)
- `pitId` (UUID)
- `s3Key` (string)
- `status` (enum):
  - `PENDING`
  - `QUEUED`
  - `RUNNING`
  - `DONE`
  - `ERROR`
- `createdAt`
- `updatedAt`

**Relations**
- Many-to-one to `User`
- Many-to-one to `Pit`

---

## 4. Passwordless Authentication (AWS SES)

Authentication is implemented using **magic links** delivered via AWS SES.

### 4.1 Request Login Email

**Endpoint**
`POST /auth/request`

**Description**

Starts the passwordless authentication flow.
The user submits their email address, and the backend sends a login magic link using AWS SES.
No password is required — authentication happens only through the emailed link.

**Request Body**
```json
{
  "email": "student@example.com"
}
```

**Response**
```json
{
  "message": "Login email sent"
}
```

**Behavior**
1. Validate the email format.
2. Create a short-lived JWT (default: 30 minutes).
3. Build a magic link:
   ```
   ${APP_URL}/auth/verify?token=<JWT>
   ```
4. Send the email through SES.
5. Always return the same success message to avoid email enumeration attacks.

**Possible Errors**

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid email |
| 500 | SES email sending failure |

**Example CURL**
```bash
curl -X POST http://localhost:3000/auth/request \
  -H "Content-Type: application/json" \
  -d '{"email": "student@example.com"}'
```

---

### 4.2 Verify Login Token

**Endpoint**
`GET /auth/verify?token=<jwt>`

**Description**

Validates the magic-link JWT sent by email.
If valid, the system:
1. Extracts the user email from the token.
2. Creates the user automatically if it does not exist.
3. Returns a session JWT that the frontend will store and send in the `Authorization: Bearer` header.

**Query Parameters**

| Name | Description |
|------|-------------|
| token | The JWT received in the login link |

**Successful Response**
```json
{
  "message": "Authenticated",
  "token": "<session-jwt>",
  "user": {
    "id": "uuid",
    "email": "student@example.com"
  }
}
```

**Behavior**
1. Validate the token signature using `JWT_SECRET`.
2. Check expiration (`MAGIC_LINK_TTL_MIN`).
3. Resolve the user:
   - If the user exists → return it.
   - If not → create a new user record in the database.
4. Generate a new longer-lived session token.
5. Return both user information and the session JWT.

**Errors**

| Status | Description |
|--------|-------------|
| 400 | Token missing or invalid format |
| 401 | Token expired |
| 500 | Unexpected server error |

**Example CURL**
```bash
curl "http://localhost:3000/auth/verify?token=<jwt>"
```

---

## 5. Users Module

The Users module manages all operations related to user data.
Users are created automatically during the authentication process (magic link login).

---

### 5.1 Entity: User

Each user is stored in the `users` table.

**Fields**
- `id` — UUID primary key
- `email` — unique email
- `name` — optional display name
- `createdAt` — timestamp
- `updatedAt` — timestamp

**Relationships**
- One user can have many submissions (1:N).

---

### 5.2 Automatic User Creation

Users are not created manually.
When the `/auth/verify` endpoint validates a magic link:
1. The email is extracted from the magic-link token.
2. The `UsersService` checks if a user exists:
   - If yes → returns user
   - If no → creates user automatically
3. The new user is stored in the database.

This simplifies onboarding because students do not need to register manually.

---

### 5.3 UsersService

**Core methods:**
- `findOrCreateByEmail(email)`
- `findById(id)`

These methods are used by:
- Authentication (`AuthModule`)
- Submissions (to associate a submission with the student)
- Future features (profile, language preferences, etc.)

---

### 5.4 Example User Object

```json
{
  "id": "15b3df9f-27d4-4dc4-b254-7395d441a064",
  "email": "student@uoc.edu",
  "name": null,
  "createdAt": "2025-11-16T19:10:03.262Z",
  "updatedAt": "2025-11-16T19:10:03.262Z"
}
```

---

## 6. Pits Module (Assignments)

A Pit represents an assignment or activity created by a professor.
Students submit their solutions to a specific Pit using the submission endpoints.

The module is intentionally simple during Phase 1, with static sample data or seeded values.
Later, professors will manage Pits from the frontend.

---

### 6.1 Entity: Pit

The `pits` table stores assignment definitions.

**Fields**
- `id` — UUID (or pre-defined identifier)
- `title` — human-readable name of the assignment
- `description` — details about the exercise
- `createdAt` — timestamp

**Relationships**
- One Pit has many submissions (1:N)

---

### 6.2 Typical Example Pit

During development we used a placeholder Pit for testing:

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "title": "Sample Assignment",
  "description": "Upload your Java ZIP for automatic evaluation."
}
```

This allows local and ECS tests without requiring a professor-facing UI.

---

### 6.3 PitsService (Current Behavior)

The service currently provides:
- `findById(id)` — used when students request presigned upload URLs
- `seedDefaultPit()` — optional dev helper
- `listAll()` — intended for future frontend use

Because authentication is based on email, Pits do not belong to a user.
They are globally accessible by ID.

---

### 6.4 Future Enhancements

Later in the TFM, Pits can evolve to include:
- Deadline / expiration
- Allowed languages
- Test configuration
- Visibility rules
- Professor ownership
- Automatic exam generation based on code

These are optional for Phase 1 and Phase 2.

---

## 7. Submissions Module

The Submissions module handles the complete workflow for a student submission:
1. Authenticate using a session JWT
2. Request a presigned S3 upload URL
3. Upload the ZIP file directly to S3
4. Confirm the submission
5. Trigger a background job via SQS
6. Later: retrieve evaluation results

This module orchestrates S3, SQS, and the database.

---

### 7.1 Entity: Submission

The `submissions` table records each submission attempt.

**Fields**
- `id` — UUID
- `userId` — FK to users table
- `pitId` — FK to pits table
- `s3Key` — the S3 path of the uploaded ZIP
- `status`
  - `PENDING`
  - `RUNNING`
  - `DONE`
  - `FAILED`
- `feedback` — JSON or text (optional; future use)
- `createdAt` — timestamp
- `updatedAt` — timestamp

**Relationships**
- Submission belongs to one User
- Submission belongs to one Pit

---

### 7.2 Submission Flow Overview

**Step 1 — User requests presigned URL**

Endpoint: `POST /submissions/request-upload`

Backend actions:
- Validate Pit ID
- Create a `fileKey`:
  ```
  submissions/<userId>/<pitId>/<timestamp>.zip
  ```
- Create a presigned PUT URL using AWS S3
- Return:
  - `uploadUrl` → used by the frontend to PUT the ZIP
  - `fileKey` → stored in DB after confirmation

**Step 2 — User uploads ZIP directly to S3**

The backend never receives the ZIP file itself.
This keeps the API fast and cheap.

Example:
```
PUT <uploadUrl>
Content-Type: application/zip
```

**Step 3 — User confirms the upload**

Endpoint: `POST /submissions/confirm`

Backend actions:
- Check user authentication
- Create a Submission record in PostgreSQL
- Enqueue message into the SQS queue:
  ```json
  {
    "submissionId": "...",
    "s3Key": "...",
    "pitId": "...",
    "userId": "..."
  }
  ```
- Status is now `PENDING`

**Step 4 — Worker consumes SQS message (Phase 3)**

The ECS Worker will:
1. Download ZIP from S3
2. Run build & tests inside isolated container
3. Upload logs/results back to S3
4. Update submission status (DONE / FAILED)
5. Save feedback into DB

This is coming in Phase 3.

---

### 7.3 Endpoints Summary

**POST /submissions/request-upload**

Authenticated → returns presigned URL + fileKey.

**POST /submissions/confirm**

Registers submission + enqueues SQS job.

**GET /submissions/:id**

(Not implemented yet)
Will return:
- `status` (PENDING/RUNNING/DONE/FAILED)
- `feedback` (optional)
- timestamps

---

### 7.4 Example Database Entry

```json
{
  "id": "fe51f529-897d-4241-b21a-675cd6a6bf3b",
  "userId": "15b3df9f-27d4-4dc4-b254-7395d441a064",
  "pitId": "11111111-1111-1111-1111-111111111111",
  "s3Key": "submissions/15b3df9f-27d4-4dc4-b254-7395d441a064/11111111-1111-1111-1111-111111111111/1763326779719.zip",
  "status": "PENDING",
  "createdAt": "2025-11-16T21:09:12.430Z"
}
```

---

## 8. AWS Integrations (S3, SQS, SES, ECS)

The backend integrates with several AWS services that enable file storage, background processing, authentication, and deployment automation.
This section summarizes how each service is used inside the API.

---

### 8.1 S3 — Storage for ZIP Submissions

Amazon S3 is used to store student submissions as ZIP files.
The API never receives the ZIP content; instead, it provides a presigned URL so the client uploads directly to S3.

**S3 Bucket**
`uoc-tfm-eval-platform`

**Folder structure**

S3 objects are organized by user and assignment (PIT):
```
submissions/<userId>/<pitId>/<timestamp>.zip
```

**API Responsibilities**
- Generate presigned PUT URLs
- Validate fileKey from client
- Store fileKey in database
- Expose results/feedback later (Phase 3)

**Benefits**
- Backend remains stateless
- No file uploads over API
- Cheap and scalable storage

---

### 8.2 SQS — Queue for Background Job Execution

The backend uses SQS to send job information to the ECS Worker service.

**Queue name:**
`submissions-queue`

**Message structure:**
```json
{
  "submissionId": "uuid",
  "s3Key": "submissions/.../file.zip",
  "pitId": "uuid",
  "userId": "uuid"
}
```

**API Responsibilities**
- Send SQS message when a submission is confirmed (`POST /submissions/confirm`)

**Worker Responsibilities (Phase 3)**
- Read SQS messages
- Download ZIP from S3
- Run compilation and tests
- Upload results & logs
- Update database

---

### 8.3 SES — Passwordless Login

AWS SES provides a secure passwordless-auth mechanism.

**SES Region**
`eu-west-1`
(Because SES for Spain region is limited)

**Email Flow**
1. User enters email
2. Backend generates a JWT magic link
3. Backend sends email using AWS SES
4. User clicks the link
5. `/auth/verify` validates token and logs user in

**Requirements**
- Sender email verified
- IAM permissions for SES
- SES region configured in environment variables

---

### 8.4 ECS — Running the API and Worker Services

The API and Worker both run as Fargate tasks in ECS.

**Cluster**
`uoc-tfm-cluster`

**Services:**
- `api-service`
- `worker-service`

**Image Sources:**
- ECR repository `uoc-tfm/api`
- ECR repository `uoc-tfm/runner`

**Task Definition Environment Variables (Injected)**
- `DATABASE_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_SQS_QUEUE_URL`
- `SES_SENDER`
- `JWT_SECRET`
- …and others.

**API Responsibilities in ECS**
- Serve HTTP requests on port 3000
- Handle auth, presigned URLs, submissions, etc.

**Worker Responsibilities**
- Poll SQS
- Execute evaluation jobs in isolated container
- Save results

---

### 8.5 IAM — Minimal Permissions Model

The backend uses IAM roles and policies attached to ECS tasks.

**API Role Permissions:**
- S3: `PutObject`/`GetObject` on `submissions/*`
- SQS: `SendMessage` on `submissions-queue`
- SES: `SendEmail`
- SecretsManager (optional for future)

**Worker Role Permissions:**
- S3: full read/write on `submissions/*`, `results/*`
- SQS: `Receive`/`DeleteMessage`
- CloudWatch Logs write access

**Purpose**
- Each component has least-privilege
- Secrets not stored in code
- ECS injects temporary credentials automatically

**Summary Diagram**

```bash
      [Frontend] ---- requests ----> [API Service]
            │                              │
            │                      generates JWT / presigned URLs
            │                              │
            ▼                              ▼
      [User receives email]         [S3 presigned upload]
            │                              │
            ▼                              ▼
      click magic link ----> [Auth Verify] │
                                           ▼
                                    [S3 Bucket]
                                           │
                                           ▼
                         [POST /submissions/confirm]
                                           │
                                           ▼
                                     [SQS Queue]
                                           │
                                           ▼
                                   [ECS Worker]
                                           │
                                           ▼
                                [Run tests + store results]
                                           │
                                           ▼
                                 [DB + S3 Results Storage]
```

---

## 9. Endpoints Overview and Full Backend Flow

This section summarizes all backend endpoints developed so far, grouped by module.
At the end, a complete end-to-end example demonstrates the full submission lifecycle.

---

### 9.1 Authentication Endpoints (Passwordless Login)

**1. Request Login Email**

`POST /auth/request`

Sends a magic-link email to the user.

**Request Body**
```json
{
  "email": "student@example.com"
}
```

**Response**
```json
{
  "message": "Login email sent"
}
```

---

**2. Verify Magic Link**

`GET /auth/verify?token=…`

Validates a magic-link JWT and creates or returns a user.

**Successful Response**
```json
{
  "message": "Authenticated",
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "student@example.com"
  }
}
```

You must extract the returned `"token"` and use it as a Bearer token for all authenticated requests.

---

### 9.2 PIT (Assignment) Endpoints

**1. Create PIT**

`POST /pits`
(Requires Bearer token)

**Minimal example:**
```json
{
  "title": "TEMA 1 - Basic Java Exercises"
}
```

**Response:**
```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "title": "TEMA 1 - Basic Java Exercises",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**2. List All PITs**

`GET /pits`

Returns all existing assignments.

---

**3. Get PIT by ID**

`GET /pits/:id`

---

### 9.3 Submission Endpoints (Upload Flow)

**1. Request Presigned Upload URL**

`POST /submissions/request-upload`

Requires authentication.

**Request Body**
```json
{
  "pitId": "11111111-1111-1111-1111-111111111111"
}
```

**Response**
```json
{
  "uploadUrl": "https://s3...signed-url",
  "fileKey": "submissions/<userId>/<pitId>/<timestamp>.zip"
}
```

You must:
1. Upload ZIP file directly to S3 using `curl -X PUT` or browser upload.
2. Then call `/submissions/confirm`.

---

**2. Confirm Submission**

`POST /submissions/confirm`

Requires authentication.

**Request Body**
```json
{
  "pitId": "11111111-1111-1111-1111-111111111111",
  "fileKey": "submissions/<userId>/<pitId>/<timestamp>.zip"
}
```

**Response:**
```json
{
  "status": "ok",
  "submissionId": "uuid"
}
```

This queues a job in SQS.

---

**3. Get Submission by ID**

`GET /submissions/:id`

(Phase 3: will return execution results and feedback)

---

**4. List Submissions of a User**

`GET /submissions/mine`

(Phase 3)

---

### 9.4 Health Check

Basic health endpoint

`GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

---

### 9.5 Full End-to-End Backend Flow (From Login to Submission)

This is the complete walkthrough of how a real student would interact with the platform backend.

---

**Step 1 — User Requests Login Link**

```bash
curl -X POST http://localhost:3000/auth/request \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com"}'
```

→ User receives email with magic link.

---

**Step 2 — User Clicks Magic Link**

```bash
curl "http://localhost:3000/auth/verify?token=<magic-jwt>"
```

Response returns:
- authenticated user
- permanent JWT access token

**Store the JWT:**
```bash
export JWT="<token-from-response>"
```

---

**Step 3 — Student Requests Upload URL**

```bash
curl -X POST http://localhost:3000/submissions/request-upload \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"pitId":"11111111-1111-1111-1111-111111111111"}'
```

Response includes:
- `uploadUrl` → signed PUT URL
- `fileKey` → S3 storage path

---

**Step 4 — Upload ZIP File Directly to S3**

```bash
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: application/zip" \
  --data-binary @exercise.zip
```

---

**Step 5 — Confirm Submission**

```bash
curl -X POST http://localhost:3000/submissions/confirm \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"pitId\":\"11111111-1111-1111-1111-111111111111\",\"fileKey\":\"$FILE_KEY\"}"
```

Backend actions:
- Stores submission in PostgreSQL
- Sends a job message to SQS
- Worker (Phase 3) will process it

---

**Step 6 — View Submission (Future Phase)**

`GET /submissions/:id`

Returns:
- status (PENDING, RUNNING, DONE, ERROR)
- test results (Junit)
- compilation logs
- final feedback

---

## 10. Database Schema and Entity Relationships

The backend uses TypeORM with PostgreSQL.
The data model is simple and optimized for the TFM scope, focusing on:
- Users
- PITs (Assignments)
- Submissions (Code uploads made by students)

Below is the complete schema, entity definitions, and an ASCII diagram of their relations.

---

### 10.1 Entity Relationship Diagram (ASCII)

```
┌─────────────────────┐          1        ┌──────────────────────────┐
│        User         │──────────────────▶│        Submission         │
│─────────────────────│                   │──────────────────────────│
│ id (UUID)           │                   │ id (UUID)                │
│ email (string)      │                   │ userId (UUID, FK)        │
│ name (string|null)  │                   │ pitId (UUID, FK)         │
│ createdAt (date)    │                   │ s3Key (string)           │
│ updatedAt (date)    │                   │ status (enum)            │
└─────────────────────┘                   │ createdAt (date)         │
                                           │ updatedAt (date)         │
                                           └──────────────┬──────────┘
                                                          │  *
                                                          │
                                                          ▼
                                                ┌───────────────────────┐
                                                │         PIT           │
                                                │───────────────────────│
                                                │ id (UUID)             │
                                                │ title (string)        │
                                                │ createdAt (date)      │
                                                │ updatedAt (date)      │
                                                └───────────────────────┘
```

**Summary:**
- One User → Many Submissions
- One PIT → Many Submissions

---

### 10.2 Entity: User

**File:** `api/src/users/user.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Submission } from '../submissions/submission.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name?: string;

  @OneToMany(() => Submission, (submission) => submission.user)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Key notes:**
- Users are automatically created during magic-link login.
- Only email is required.
- `submissions` is the reverse relation for listing user's submissions.

---

### 10.3 Entity: PIT (Programming Assignment)

**File:** `api/src/pits/pit.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Submission } from '../submissions/submission.entity';

@Entity('pits')
export class Pit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @OneToMany(() => Submission, (submission) => submission.pit)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Notes:**
- Instructor/admin creates PITs.
- Each submission must link to one PIT.

---

### 10.4 Entity: Submission

**File:** `api/src/submissions/submission.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Pit } from '../pits/pit.entity';

export enum SubmissionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.submissions, { eager: false })
  user: User;

  @ManyToOne(() => Pit, (pit) => pit.submissions, { eager: false })
  pit: Pit;

  @Column()
  s3Key: string;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  status: SubmissionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Notes:**
- `s3Key` stores `submissions/<user>/<pit>/<timestamp>.zip`
- Worker updates status to RUNNING/DONE/ERROR
- Future extension: add logs, metrics, static analysis, plagiarism detection

---

### 10.5 Full Database Schema (Generated by TypeORM)

After running the API once (with `synchronize: true`), PostgreSQL contains:

**Table: `users`**
```
id          UUID (PK)
email       VARCHAR UNIQUE
name        VARCHAR NULL
createdAt   TIMESTAMP DEFAULT now()
updatedAt   TIMESTAMP DEFAULT now()
```

**Table: `pits`**
```
id          UUID (PK)
title       VARCHAR
createdAt   TIMESTAMP
updatedAt   TIMESTAMP
```

**Table: `submissions`**
```
id          UUID (PK)
"userId"    UUID (FK → users.id)
"pitId"     UUID (FK → pits.id)
"s3Key"     VARCHAR
status      ENUM('PENDING','RUNNING','DONE','ERROR')
createdAt   TIMESTAMP
updatedAt   TIMESTAMP
```

---

### 10.6 Example Queries (psql)

**List all users**
```sql
SELECT id, email, createdAt FROM users;
```

**List PITs**
```sql
SELECT id, title FROM pits ORDER BY createdAt DESC;
```

**List submissions**
```sql
SELECT id, "userId", "pitId", "s3Key", status, "createdAt"
FROM submissions
ORDER BY "createdAt" DESC;
```

---

## 11. S3 Storage Structure & Naming Strategy

The platform uses Amazon S3 as the primary storage layer for student submissions.
Uploaded ZIP files are stored through a presigned URL generated by the API and later consumed by the worker service.

Below is the full description of the S3 structure, naming conventions, and rationale.

---

### 11.1 Bucket Overview

**Bucket name:**
`uoc-tfm-eval-platform`

This bucket stores:
- ZIP files uploaded by students
- (future) Worker output reports (JUnit results, logs, feedback text)

No public access is enabled.
All operations occur through presigned URLs or IAM-restricted ECS task roles.

---

### 11.2 S3 Folder Structure

Every uploaded file follows a deterministic and organized path:

```
/submissions/<userId>/<pitId>/<timestamp>.zip
```

**Example:**
```
submissions/15b3df9f-27d4-4dc4-b254-7395d441a064/11111111-1111-1111-1111-111111111111/1763326779719.zip
```

**Where:**

| Segment | Meaning |
|---------|---------|
| `submissions` | Root folder for all submission uploads |
| `<userId>` | UUID of the student |
| `<pitId>` | Assignment identifier |
| `<timestamp>.zip` | Unix timestamp + .zip, ensuring uniqueness |

This structure enables:
- Fast lookups of submissions by user or PIT
- Preventing filename collisions
- Simple cleanup patterns per user or assignment

---

### 11.3 Naming Strategy

**🔸 File Names**

Naming follows:
```
<timestamp>.zip
```

Where `timestamp = Date.now()` in milliseconds.

**Benefits:**
- Guaranteed uniqueness
- Natural chronological ordering
- De-coupled from original filenames (security)

---

**🔸 Why ZIP?**

ZIP format is required because:
1. It standardizes student submissions
2. The worker runner extracts the archive inside a Docker container
3. JUnit/Maven/Gradle workflows expect directories with `src/` and `tests`

Students upload their code zipped via the UI or command-line.

---

### 11.4 S3 Permissions

The API does not directly upload files.
Instead, it generates a presigned URL using:
- `PutObjectCommand`
- 5-minute expiration (300 seconds)

Worker tasks use:
- IAM-managed ECS task role
- Limited S3 access via IAM policy:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::uoc-tfm-eval-platform/submissions/*"
}
```

This ensures:
- User cannot access files of other users
- Worker cannot access unrelated S3 paths
- API can only generate presigned URLs, not manipulate files directly

---

### 11.5 Example Presigned URL Workflow

**1. Student requests an upload slot**

```http
POST /submissions/request-upload
Authorization: Bearer <JWT>
{
  "pitId": "<uuid>"
}
```

**API returns:**
```json
{
  "uploadUrl": "https://uoc-tfm-eval-platform.s3.eu-south-2.amazonaws.com/submissions/.../timestamp.zip?...",
  "fileKey": "submissions/<user>/<pit>/<timestamp>.zip"
}
```

**2. Student uploads ZIP directly to S3**

```bash
curl -X PUT "$uploadUrl" \
  -H "Content-Type: application/zip" \
  --data-binary @file.zip
```

**3. Student confirms the upload**

```http
POST /submissions/confirm
{
  "pitId": "...",
  "fileKey": "submissions/.../timestamp.zip"
}
```

On confirmation:
- A database record is created
- An SQS message is enqueued for the worker

---

### 11.6 Future Extensions (Optional)

The S3 structure can be extended in Phase 3 or 4:

**✦ Add worker output folder**
```
results/<submissionId>/report.json
results/<submissionId>/logs.txt
```

**✦ Store static-analysis reports**
```
analysis/<submissionId>/eslint.json
analysis/<submissionId>/complexity.txt
```

**✦ Store plagiarism comparison data**
```
similarity/<pitId>/matrix.json
```

---

### 11.7 Cleanup Strategy (AWS Cost Optimization)

Since this is a TFM project:
- You may delete the entire bucket after project completion
- Or keep only results for the final demonstration

**A safe cleanup command (AWS CLI):**
```bash
aws s3 rm s3://uoc-tfm-eval-platform --recursive --profile uoc-tfm
```

---

## 12. SQS Queue Flow - Submission Processing Pipeline

The platform uses Amazon SQS as the communication channel between the API and the Worker service.
When a student confirms a submission, the backend enqueues a job into SQS.
The Worker consumes these messages and executes the actual code evaluation.

This decouples HTTP request handling from heavy, long-running tasks.

---

### 12.1 Queue Overview

**Queue name:**
`submissions-queue`

**Purpose:**
- Buffer submission jobs
- Decouple API availability from worker load
- Enable horizontal scaling of worker tasks

---

### 12.2 Message Structure

Each message contains all the information required by the worker to process one submission:

```json
{
  "submissionId": "fe51f529-897d-4241-b21a-675cd6a6bf3b",
  "userId": "15b3df9f-27d4-4dc4-b254-7395d441a064",
  "pitId": "11111111-1111-1111-1111-111111111111",
  "s3Key": "submissions/<userId>/<pitId>/<timestamp>.zip"
}
```

**Required fields:**
- `submissionId` → DB record ID to update later
- `userId` → for logging / future notifications
- `pitId` → assignment context (test configuration)
- `s3Key` → S3 path for the ZIP to download

**Optional future fields:**
- `language` (java, python, etc.)
- `runtime` (maven, gradle)
- extra parameters (e.g. exam mode)

---

### 12.3 API Responsibilities (Producer)

The API sends messages when:
1. Student calls `POST /submissions/confirm`
2. Submission record is successfully created in the database

At that moment, the API:
- Creates the SQS message payload
- Sends it to `submissions-queue`
- Keeps the submission status as `PENDING`

If SQS fails, the API can:
- Log the error
- Optionally mark submission as `ERROR`

---

### 12.4 Worker Responsibilities (Consumer)

The Worker is an ECS service that:
1. Polls `submissions-queue` using long polling
2. For each message:
   - Parses JSON payload
   - Fetches ZIP from S3 (`s3Key`)
   - Runs compilation and tests in an isolated environment (Docker)
   - Collects results, logs, and scores
   - Updates the submission in DB:
     - `status = DONE` (success)
     - `status = ERROR` (failure)
   - Optionally uploads logs/results back to S3
3. Deletes the message from the queue once processing is complete

---

### 12.5 Queue Semantics

- **At-least-once delivery**: the same message may be delivered multiple times
- **Worker must be idempotent:**
  - Re-processing the same `submissionId` should not break the system
  - Typical strategy: track status in DB and avoid re-running completed submissions

---

### 12.6 Error Handling & Visibility Timeout

To prevent messages from being lost:
- A visibility timeout is configured (e.g. 5-10 minutes)
- If the Worker:
  - crashes
  - times out
  - fails to `DeleteMessage`

Then the message becomes visible again and can be reprocessed by another Worker.

Submissions stuck in repeated failure can:
- Be marked as `ERROR` in DB
- Be sent to a Dead Letter Queue (DLQ) (future enhancement)

---

### 12.7 Observability

Useful SQS attributes to monitor:
- `ApproximateNumberOfMessages`
- `ApproximateNumberOfMessagesNotVisible`
- `ApproximateAgeOfOldestMessage`

**Example AWS CLI command:**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-south-2.amazonaws.com/<account-id>/submissions-queue \
  --attribute-names All \
  --region eu-south-2 \
  --profile uoc-tfm
```

---

### 12.8 Summary of the Pipeline

1. Student uploads ZIP to S3.
2. Student confirms submission → API stores DB record.
3. API sends SQS message with `submissionId`, `s3Key`, `pitId`, `userId`.
4. Worker consumes message, runs tests, updates DB, and deletes message from SQS.
5. Student (or professor) can later query the status and feedback via the API.

---

## 13. Worker Runner Logic

The Worker service is responsible for processing submission jobs asynchronously.
It listens to the SQS queue, downloads the student's ZIP file from S3, executes the evaluation commands inside a controlled Docker environment, and uploads the results back to the database and S3.

---

### 13.1 Overview

The Worker container runs continuously inside ECS Fargate and performs the following loop:
1. Poll SQS for a new submission message.
2. When a message arrives:
   - Parse: `submissionId`, `pitId`, `fileKey`, and `userId`.
3. Download the ZIP from S3.
4. Extract & prepare environment inside a runner sandbox.
5. Execute the evaluation pipeline:
   - Build the project
   - Run tests
   - Capture logs, test results, and exit codes
6. Store output:
   - Upload logs to S3
   - Update submission status in the database
7. Delete the SQS message (only if successful).
8. Loop again.

This model ensures asynchronous, scalable grading.

---

### 13.2 SQS Message Format

Each message pushed by the API to SQS includes:

```json
{
  "submissionId": "UUID",
  "userId": "UUID",
  "pitId": "UUID",
  "fileKey": "submissions/<user>/<pit>/<timestamp>.zip",
  "timestamp": 1763326779719
}
```

All properties are required.

---

### 13.3 S3 Download & Extraction

The Worker downloads the ZIP using:

```typescript
await s3Client.send(
  new GetObjectCommand({ Bucket, Key: fileKey })
);
```

**Steps:**
1. Save object to `/tmp/submission.zip`
2. Extract to `/tmp/workdir`
3. Validate:
   - ZIP is not empty
   - Contains source code
   - Optional: forbidden structures

---

### 13.4 Evaluation Pipeline

Each PIT (assignment) defines its execution configuration:

```json
{
  "language": "java",
  "buildTool": "maven",
  "jdkVersion": 17,
  "timeoutMs": 120000
}
```

**Execution steps**

1. **Set up runner environment**
   - Use bundled JDK
   - Use Maven or Gradle inside the container

2. **Run build**

   Example for Maven:
   ```bash
   mvn -q -e -DskipTests=false test
   ```

3. **Capture results**
   - stdout
   - stderr
   - exit code
   - test report artifacts (JUnit XML)

4. **Detect grading outcome**
   - Exit code 0 → success
   - Exit code >0 → failed tests
   - Timeout → error
   - Exception → error

---

### 13.5 Uploading Results

The Worker uploads evaluation outputs to S3:

```
results/<submissionId>/log.txt
results/<submissionId>/report.xml
```

And updates the database:

```sql
UPDATE submissions
SET status = 'DONE',
    score = <computed>,
    feedbackKey = <s3-path>,
    updatedAt = NOW()
WHERE id = <submissionId>;
```

Errors update the submission to:
```sql
status = 'ERROR'
```

---

### 13.6 Message Deletion

Only after successful processing, the SQS message is removed:

```typescript
await sqsClient.send(
  new DeleteMessageCommand({ QueueUrl, ReceiptHandle })
);
```

If the worker crashes or times out, SQS re-delivers the message automatically (visibility timeout).

---

### 13.7 Error Scenarios

| Case | Handling |
|------|----------|
| ZIP missing from S3 | Mark submission as ERROR |
| Timeout | Mark as ERROR |
| Build failure | Mark as DONE but with score 0 |
| Invalid ZIP | ERROR |
| Runner internal crash | Message returned to queue |

---

### 13.8 Security & Isolation

To ensure safe execution:
- Runner uses a non-root user
- Code runs inside a restricted container
- No network access (optional policy)
- `/tmp` mounted inside Fargate task only
- Maximum runtime controlled by a timeout

---

## 14. Runner Docker Image

The Runner Docker image is the execution environment used by the Worker service to grade student submissions safely and consistently.
It contains all the tools required to build, test, and analyze Java projects.

This image is built once and pushed to Amazon ECR, then pulled dynamically by ECS Fargate tasks.

---

### 14.1 Purpose of the Runner Image

The runner image provides:
- ✔️ A controlled and reproducible environment for executing untrusted student code
- ✔️ JDK (17) preinstalled
- ✔️ Maven (or Gradle) build tools
- ✔️ Limited filesystem access (sandbox inside container)
- ✔️ No network access (optional rule for safety)
- ✔️ CLI tools required for:
  - Extracting ZIP files
  - Running builds
  - Parsing test results

This ensures consistent evaluation across all submissions.

---

### 14.2 Dockerfile Structure

Below is the simplified structure of the runner Dockerfile:

```dockerfile
FROM eclipse-temurin:17-jdk

# Install ZIP utilities and build tools
RUN apt-get update && \
    apt-get install -y unzip maven && \
    apt-get clean

# Create runner user
RUN useradd -m runner
USER runner

WORKDIR /home/runner/workdir

COPY scripts/runner.sh /usr/local/bin/runner.sh
RUN chmod +x /usr/local/bin/runner.sh

ENTRYPOINT ["/usr/local/bin/runner.sh"]
```

**Key features:**
- Uses Eclipse Temurin JDK 17
- Preloads Maven (more build tools can be added)
- Runs as a non-root user
- Includes a dedicated runtime script (`runner.sh`)

---

### 14.3 Execution Script (runner.sh)

The runner script orchestrates the evaluation:

```bash
#!/bin/bash
set -e

ZIP_PATH=$1
SUBMISSION_ID=$2
OUTPUT_DIR="/tmp/output"

mkdir -p "$OUTPUT_DIR"

# Extract ZIP
unzip "$ZIP_PATH" -d /tmp/workdir

cd /tmp/workdir

# Run Maven tests
mvn -q -e -DskipTests=false test > "$OUTPUT_DIR/build.log" 2>&1
EXIT_CODE=$?

# Copy test reports
cp -r target/surefire-reports "$OUTPUT_DIR" 2>/dev/null || true

echo "Exit code: $EXIT_CODE" >> "$OUTPUT_DIR/build.log"

exit $EXIT_CODE
```

The Worker reads the logs generated in `/tmp/output` and uploads them to S3.

---

### 14.4 Building the Runner Image

**Locally:**
```bash
docker build -t uoc-tfm-runner:latest ./runner
```

**Confirm the image exists:**
```bash
docker images | grep runner
```

---

### 14.5 Pushing the Image to ECR

**Authenticate to ECR:**
```bash
aws ecr get-login-password --region eu-south-2 --profile uoc-tfm \
  | docker login --username AWS --password-stdin 451747690955.dkr.ecr.eu-south-2.amazonaws.com
```

**Tag and push:**
```bash
docker tag uoc-tfm-runner:latest 451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:latest

docker push 451747690955.dkr.ecr.eu-south-2.amazonaws.com/uoc-tfm/runner:latest
```

---

### 14.6 Updating ECS to Use the New Runner Image

Once pushed, trigger a manual redeployment:

```bash
aws ecs update-service \
  --cluster uoc-tfm-cluster \
  --service worker-service \
  --force-new-deployment \
  --region eu-south-2 \
  --profile uoc-tfm
```

ECS will pull the new runner image automatically.

---

### 14.7 Security Considerations

To protect the system when running untrusted code:

| Measure | Description |
|---------|-------------|
| Non-root user | Prevents privileged operations inside the container |
| Network isolation | The container does not need external network access |
| Limited filesystem | Only `/tmp/workdir` is writable |
| Execution timeout | Worker kills long-running builds |
| Resource limits | CPU/memory capped via ECS task definition |

These constraints make the runner safe for academic evaluation.

---

## 15. Interaction Between API, Worker, and AWS

This section explains how the API, Worker, and AWS services collaborate to process student submissions end-to-end.
The system follows an event-driven architecture using S3 and SQS as the central integration components.

The flow can be understood in three stages:
1. Submission request (API + S3 Presigned URL)
2. Job dispatching (API → SQS)
3. Async evaluation (Worker → S3 → RDS)

---

### 15.1 High-Level Flow Diagram

```
flowchart TD
    A[Student uploads ZIP via frontend] --> B(API)
    B --> C[Generate S3 presigned URL]
    C --> D[Student uploads ZIP to S3]
    D --> E[API: confirm upload]
    E --> F[API pushes job to SQS]
    F --> G[Worker service polls SQS]
    G --> H[Worker downloads ZIP from S3]
    H --> I[Worker runs Maven/JUnit evaluation]
    I --> J[Worker uploads logs/results to S3]
    J --> K[Worker updates DB (PostgreSQL/RDS)]
    K --> L[Student fetches results]
```

---

### 15.2 Responsibilities Overview

| Component | Responsibilities |
|-----------|------------------|
| API | Authentication, ZIP upload coordination, SQS job dispatch, DB writes, feedback endpoints |
| Worker | Job processing, sandbox execution, S3 downloads/uploads, scoring, updating DB |
| S3 | Stores student submissions and evaluation artifacts |
| SQS | Job queue guaranteeing reliable async processing |
| RDS (PostgreSQL) | Stores users, pits, and submissions status/results |
| SES | Sends login magic links |
| ECS | Runs API and Worker containers |

---

### 15.3 Step-by-Step Interaction

Below is the detailed sequence behind every submission.

---

#### 15.3.1 Step 1 — Request Upload URL (API)

The student (authenticated) asks for a presigned upload URL:

```http
POST /submissions/request-upload
Authorization: Bearer <token>
```

The API:
1. Creates a new submission row with `status = PENDING_UPLOAD`
2. Generates a presigned S3 PUT URL
3. Returns `{ uploadUrl, fileKey }` to the client

This ensures each upload is uniquely associated with a submission.

---

#### 15.3.2 Step 2 — Student Uploads ZIP to S3

Using the presigned URL, the frontend uploads the ZIP directly to S3:

```http
PUT https://<bucket>.s3.amazonaws.com/<fileKey>
```

This bypasses the API completely, reducing bandwidth and cost.

---

#### 15.3.3 Step 3 — Student Confirms Upload

Client endpoint:
```http
POST /submissions/confirm
```

API operations:
- Set `status = QUEUED`
- Send an SQS message:

```json
{
  "submissionId": "UUID",
  "fileKey": "...zip",
  "pitId": "UUID",
  "userId": "UUID",
  "timestamp": 1763326779719
}
```

At this point SQS becomes the source of truth for job execution.

---

#### 15.3.4 Step 4 — Worker Polls SQS

Worker continuously runs:
```typescript
ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 1 })
```

When a job arrives:
- Worker extracts message fields
- Worker downloads ZIP from S3
- Worker runs evaluation using the Runner image

The submission status becomes: `PROCESSING`

---

#### 15.3.5 Step 5 — Worker Executes Tests

Inside the isolated container:
1. ZIP extracted into `/tmp/workdir`
2. Build system invoked (Maven)
3. Tests executed
4. Results captured:
   - exit code
   - logs
   - JUnit XML
   - duration
5. Score calculated (optional in this phase)

If everything succeeds → continue
If there is an exception / timeout → mark as ERROR

---

#### 15.3.6 Step 6 — Worker Uploads Results to S3

Results stored like:
```
results/<submissionId>/log.txt
results/<submissionId>/report.xml
```

Worker registers the file locations in the database.

---

#### 15.3.7 Step 7 — Worker Updates Database

Typical update:
```sql
UPDATE submissions
SET status = 'DONE',
    score = <score>,
    feedbackKey = 'results/<id>/log.txt',
    updatedAt = NOW()
WHERE id = <submissionId>;
```

On error:
```sql
status = 'ERROR'
```

---

#### 15.3.8 Step 8 — Delete SQS Message

Only after DB write + file upload succeeds:
```typescript
DeleteMessageCommand()
```

This ensures exactly-once (or very close) processing semantics.

---

### 15.4 Error Handling Flow

| Component | Possible Error | Effect |
|-----------|----------------|--------|
| API | Missing pit, invalid file key | 400 Bad Request |
| S3 | Upload expired | Student must retry |
| SQS | Delivery failed | Automatic retry |
| Worker | Timeout | Mark ERROR, requeue if needed |
| Runner | Build fails | Status = DONE, score = 0 |
| DB | Write fails | SQS message is not deleted → retried |

---

### 15.5 Security Measures

| Layer | Security |
|-------|----------|
| API | JWT auth + ownership checks (user must own submission) |
| S3 | Presigned URLs with expiration |
| Worker | Non-root user, isolated Fargate container |
| RDS | Private subnets only (no internet) |
| SQS | Only API → Worker allowed |
| SES | Verified sender only |

---

## 16. Error Logging and CloudWatch Monitoring

The platform uses AWS CloudWatch Logs to collect and centralize logs from both the API and Worker services running on ECS Fargate.
This allows debugging runtime failures, tracking job execution, and monitoring system health.

Two log groups were created automatically during ECS provisioning:

| Service | Log Group |
|---------|-----------|
| API | `/ecs/api` |
| Worker | `/ecs/worker` |

Both services stream all console output (console.log, Nest logs, evaluation logs, errors) to CloudWatch automatically.

---

### 16.1 API Logging

The API logs include:
- Boot messages (NestJS lifecycle)
- Database connection status
- Authentication events (request login, verify token)
- Submission lifecycle events:
  - request-upload
  - confirm
  - errors (invalid pit, unauthorized access, expired URLs)
- Uncaught exceptions handled by NestJS
- Any custom logs added in controllers/services

**Example (CloudWatch extract):**
```
[Nest] 4201   - 11/16/2025, 18:40:12     LOG [NestApplication] Nest application successfully started
DB connection established
POST /auth/request 200 - 45ms
POST /submissions/confirm 201 - 30ms
```

---

### 16.2 Worker Logging

Worker logs are more detailed, since they include the evaluation process.
Logs typically contain:
- SQS message receipt
- File download from S3
- ZIP extraction
- Build/test execution process
- JUnit summary
- Error stack traces during execution
- Upload of results back to S3
- DB update completion

**Example:**
```
Received job: submission fe51f529-897d-4241-b21a-675cd6a6bf3b
Downloading s3://uoc-tfm-eval-platform/submissions/<...>.zip
Running maven tests...
✔ Tests completed: 4 passed, 1 failed
Uploading results to S3...
Updating submission status → DONE
Deleting SQS message
```

**On errors:**
```
ERROR Timeout after 120000ms
Marking submission as ERROR
```

---

### 16.3 Accessing Logs in CloudWatch

To open logs:
1. Go to AWS Console → CloudWatch
2. Select Logs → Log Groups
3. Choose one:
   - `/ecs/api`
   - `/ecs/worker`
4. Select the latest stream (sorted by timestamp)

You can filter logs using the search bar, e.g.:
```
"ERROR"
"submission"
"SQS"
"maven"
```

---

### 16.4 ECS Service-Level Insights

Each ECS service also exposes:
- Task event logs (placements, failures)
- Restart reasons
- Task exit codes

Navigate to:
```
ECS Console → Clusters → uoc-tfm-cluster
 → Services → api-service / worker-service
 → Tasks → Select task → Logs / Events
```

Useful when debugging:
- image pull failures
- parameter errors
- CPU/memory throttling
- container exits (e.g., OOMKilled)

---

### 16.5 Error Categories and How to Read Them

**1. API-Level Errors**

Common messages:
- `ECONNREFUSED` → DB not reachable
- `UnauthorizedException` → bad JWT
- `Invalid Authorization format`

Look for these in `/ecs/api`.

---

**2. Worker Execution Errors**
- `TimeoutError` → long-running tests
- `CannotPullContainerError` → ECR login or image missing
- `AccessDenied` from S3 → missing IAM permissions

Look in `/ecs/worker`.

---

**3. AWS Errors (S3, SQS, SES)**

You will see messages like:
```
AccessDenied: Request has expired
MessageRejected: Email address is not verified
```

These indicate misconfiguration of credentials or AWS services.

---

**4. Task/Deployment Errors**

On ECS console:
```
Essential container in task exited
CannotStartContainerError
CannotPullContainerError
```

These are infrastructure-level problems.

---

### 16.6 CloudWatch Metrics and Monitoring (Optional Extension)

You can expand monitoring by enabling:
- CPU/Memory alarms
- SQS Queue Length alarms
- Dead-Letter Queue (DLQ) for worker failures
- RDS connections / CPU monitoring
- API-level metrics (Invocations, Errors, Latency)

These are optional for the TFM but recommended if the system grows.

---

### 16.7 Summary

CloudWatch provides complete visibility into:
- API requests
- Worker background job execution
- Errors and stack traces
- Submission flow (end-to-end)
- ECS task lifecycle events

This logging setup is essential for debugging, monitoring performance, and validating correct behavior of the platform during TFM evaluation.

---

## 17. End-to-End Example: From Login to Feedback

This section illustrates the complete flow of a student submission, covering all backend interactions—from authentication to the generation and retrieval of automated feedback.

This example is valuable for the technical annex of the TFM because it demonstrates:
- how each backend module interacts,
- how AWS integrates into the process,
- and how a real submission travels across the system.

---

### 17.1 Step 1 — Student Requests Login Email

The student initiates authentication by requesting a magic login link.

**Request**
```bash
curl -X POST http://localhost:3000/auth/request \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com"}'
```

**Response**
```json
{ "message": "Login email sent" }
```

**Backend flow**
1. `AuthController` receives the request.
2. The system creates a JWT containing
   - email
   - timestamps (iat, exp)
3. SES sends an email containing
   ```
   GET /auth/verify?token=...
   ```
4. No database writes occur yet.

---

### 17.2 Step 2 — Student Clicks the Magic Link

The link from the email calls:
```
GET /auth/verify?token=<jwt>
```

**Response:**
```json
{
  "message": "Authenticated",
  "token": "<session-jwt>",
  "user": {
    "id": "15b3df9f-27d4-4dc4-b254-7395d441a064",
    "email": "student@example.com"
  }
}
```

**Backend flow**
1. Token is validated using `JWT_SECRET`.
2. If the user does not exist:
   - The system creates a new record in `users`.
3. The backend returns a session JWT used for all protected endpoints.

---

### 17.3 Step 3 — Student Requests an Upload URL

The student selects a "PIT" (assignment) and requests permission to upload a submission.

**Request**
```bash
curl -X POST http://localhost:3000/submissions/request-upload \
  -H "Authorization: Bearer <session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"pitId":"11111111-1111-1111-1111-111111111111"}'
```

**Response:**
```json
{
  "uploadUrl": "https://uoc-tfm-eval-platform.s3.eu-south-2.amazonaws.com/submissions/...zip?X-Amz-Signature=...",
  "fileKey": "submissions/<userId>/<submissionId>/<timestamp>.zip"
}
```

**Backend flow**
1. Verifies JWT (via `AuthGuard`).
2. Confirms PIT exists.
3. Generates a submission UUID but does not write to DB yet.
4. Generates a 5-minute presigned PUT URL.
5. Returns the path where the ZIP must be uploaded.

---

### 17.4 Step 4 — Student Uploads the ZIP File to S3

The backend is not involved in this step.

**Request**
```bash
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: application/zip" \
  --data-binary @submission.zip
```

**Result**

The file is now stored in S3 in the correct prefix.

---

### 17.5 Step 5 — Student Confirms Their Upload

After uploading, the student notifies the backend:

**Request**
```bash
curl -X POST http://localhost:3000/submissions/confirm \
  -H "Authorization: Bearer <session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
        "pitId":"11111111-1111-1111-1111-111111111111",
        "fileKey":"submissions/<userId>/<submissionId>/<timestamp>.zip"
      }'
```

**Response:**
```json
{
  "status": "ok",
  "submissionId": "fe51f529-897d-4241-b21a-675cd6a6bf3b"
}
```

**Backend flow**
1. Creates a submission DB record:
   ```
   status = "PENDING"
   ```

2. Sends a message to SQS queue:
   ```json
   {
     "submissionId": "...",
     "userId": "...",
     "pitId": "...",
     "fileKey": "..."
   }
   ```

Worker is now automatically triggered.

---

### 17.6 Step 6 — Worker Processes the Submission (Async)

This step happens on AWS ECS (Runner container).

**Worker flow**
1. Receives SQS message
2. Downloads ZIP from S3
3. Extracts files into a temporary directory
4. Executes:
   - `mvn test` (or gradle)
   - collects JUnit XML output
5. Parses and summarizes results:
   - number of tests
   - passes/fails
   - detailed failure messages
6. Uploads `feedback.json` and logs back to S3
7. Updates DB:
   ```
   status = "DONE" or "ERROR"
   ```
8. Deletes SQS message

**Example S3 structure:**
```
submissions/<user>/<submission>/input.zip
submissions/<user>/<submission>/feedback.json
submissions/<user>/<submission>/logs.txt
```

---

### 17.7 Step 7 — Student Retrieves Feedback

Once the worker updates the submission to `DONE`, the student retrieves the results.

**Request**
```bash
curl -X GET http://localhost:3000/submissions/fe51f529-897d-4241-b21a-675cd6a6bf3b \
  -H "Authorization: Bearer <session-jwt>"
```

**Successful Response**
```json
{
  "id": "fe51f529-897d-4241-b21a-675cd6a6bf3b",
  "status": "DONE",
  "result": {
    "testsPassed": 4,
    "testsFailed": 1,
    "failures": [
      {
        "test": "CalculatorTest.addition",
        "message": "Expected 4 but got 5"
      }
    ]
  }
}
```

**If the worker marked it as an error:**
```json
{
  "id": "...",
  "status": "ERROR",
  "error": "Build failed: could not compile sources"
}
```

---

### 17.8 Full System Flow Diagram (Text Version)

```
[Student]
   ↓ (1: /auth/request)
[API → SES]
   ↓ (2: email link)
[Student clicks link]
   ↓ (3: /auth/verify)
[API → Users DB]

Student authenticated
   ↓ (4: /submissions/request-upload)
[API → S3 presigned URL]
   ↓
Student PUTs ZIP to S3
   ↓ (5: /submissions/confirm)
[API → RDS + SQS enqueue]

   ↓ (6: Worker)
[Worker → SQS → S3 → Run tests → Upload output → RDS update]

   ↓ (7: /submissions/:id)
[API → returns feedback]
```

---

### 17.9 Summary

This complete workflow demonstrates:
- Authentication using passwordless email
- Safe file uploads using presigned URLs
- Asynchronous background processing using ECS Fargate + SQS
- Automated code evaluation using Maven/JUnit inside isolated containers
- Persistent tracking via RDS
- Feedback delivery through the API

This is the full backend lifecycle of the UOC TFM evaluation platform.

---

## 18. Runner Service Setup and Boot Instructions

The Runner service is a separate microservice that processes submissions asynchronously. It runs independently from the API and is deployed as its own ECS Fargate task.

### 18.1 Local Setup

**Navigate to runner directory:**
```bash
cd runner
```

**Install dependencies:**
```bash
npm install
```

**Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` and configure the following required variables:
- `AWS_REGION` - AWS region (e.g., eu-south-2)
- `AWS_S3_BUCKET` - S3 bucket name
- `AWS_SQS_QUEUE_URL` - Full SQS queue URL
- `DATABASE_URL` - PostgreSQL connection string

Or use individual database variables:
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`

Optional configuration:
- `RUNNER_POLL_INTERVAL_MS` (default: 20000)
- `RUNNER_TIMEOUT_MS` (default: 120000)
- `RUNNER_MAX_LOG_BYTES` (default: 200000)

**Build and run:**
```bash
npm run build
npm run start
```

### 18.2 Configuration Validation

The runner validates all required environment variables on startup. If any are missing, it will:
1. Display a clear error message
2. Exit with code 1
3. Prevent startup in an invalid state

**Example successful startup:**
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

### 18.3 Runner Architecture

The runner follows this workflow:
1. Poll SQS for submission messages
2. Download submission ZIP from S3
3. Extract ZIP into isolated workspace
4. Load PIT configuration
5. Execute tests (Maven/Gradle)
6. Parse results (JUnit XML)
7. Upload logs to S3
8. Update submission status in PostgreSQL
9. Delete SQS message (on success)

For complete runner documentation, see [`docs/runner.md`](./runner.md).

---

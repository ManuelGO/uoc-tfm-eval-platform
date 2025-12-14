# UOC TFM – Automatic Code Evaluation Platform

A cloud-based platform for automated evaluation of programming assignments.
Students upload their solutions as a ZIP file, the system executes predefined tests in an isolated environment, and returns structured feedback and scoring.

This project has been developed by **Manuel de Jesús González Arvelo** as part of the **Master's Final Project (TFM)** at the **Universitat Oberta de Catalunya (UOC)**.

![CI](https://github.com/ManuelGO/uoc-tfm-eval-platform/actions/workflows/ci.yml/badge.svg)

---

## 🚀 Main Features

- Passwordless authentication using **Magic Links**
- Automated execution of unit tests in isolated containers
- Asynchronous processing using message queues
- Separation between **student solutions** and **instructor tests**
- Support for Java + Maven (designed to be extensible)
- Real-time submission status tracking
- Centralized log storage and result persistence

---

## 🧩 System Overview

The platform is composed of three main components:

- **Frontend**
  Web interface where users authenticate, manage PITs, upload submissions, and view results.

- **Backend API**
  REST API responsible for authentication, submission handling, PIT management, and persistence.

- **Runner Service**
  A containerized worker that consumes submission messages, prepares the execution workspace, runs tests, parses results, and reports outcomes back to the API.

The system is designed around asynchronous processing to ensure scalability and fault isolation.

---

## 🧪 Evaluation Model

- Students upload **only their solution code**
- Instructors provide **tests separately**, associated with a PIT
- During execution, both are merged in an isolated workspace
- Tests are executed using the configured command (e.g. `mvn test`)
- Results include:
  - Passed / failed test counts
  - Execution logs
  - A score based on pass rate

---

## ⚙️ Technologies Used

### Backend
- Node.js (NestJS)
- PostgreSQL
- AWS S3 (file & log storage)
- AWS SQS (submission queue)

### Runner
- Node.js
- Docker
- Maven (for Java evaluation)
- Isolated execution per submission

### Frontend
- Angular
- REST-based communication with backend API

---

## 📁 Project Structure

```text
uoc-tfm-eval-platform/
├── api/          # Backend API (NestJS)
├── runner/       # Test execution service
├── frontend/     # Web frontend
├── docs/         # Documentation (manuals, diagrams)
├── scripts/      # Helper scripts
└── README.md
```

---

## 🧑‍🏫 PIT Configuration

Each Programming Interactive Task (PIT) is associated with a configuration file that defines:
- Language
- Build tool
- Test command
- Execution timeout

If a PIT-specific configuration is not found, the system falls back to a default configuration (default.json) to simplify testing and demonstrations.

---

## 📘 User Documentation

A user-oriented guide (in Spanish) is available here:
`docs/manual-usuario.md`

This document explains how to:
- Authenticate using Magic Links
- Activate a PIT
- Upload a solution
- Interpret execution results

---

## 🔒 Security Considerations

- Passwordless authentication (no stored passwords)
- Isolated execution per submission
- Limited execution time and workspace cleanup
- Controlled file handling and ZIP extraction safeguards

---

## 📈 Current Limitations

- Only Java + Maven is fully supported
- Single runner instance (scaling not automated)
- Frontend deployment is intended for demonstration purposes

---

## 🔮 Future Work

- Support for additional languages (Python, JavaScript, etc.)
- Static code analysis (PMD, Checkstyle, Flake8, etc.)
- Horizontal scaling of runners
- Instructor dashboards and analytics
- IDE integration (e.g. JetBrains plugins)

---

## 📜 License

This project has been developed for academic purposes as part of a Master's Final Project.

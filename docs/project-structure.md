# Project & Test Structure Guidelines

This document explains how **student submissions** and **professor test archives (PIT tests)** must be structured so the evaluation pipeline (API + Runner) can compile and run tests correctly.

> 💡 The runner expects **standard Maven projects** and executes:
>
> ```bash
> mvn -q test
> ```
>
> inside the workspace created from the uploaded ZIP.

---

## 1. Student Submission ZIP

### 1.1. Required: Maven project at ZIP root

When the student uploads a ZIP, its **root** must contain a valid Maven project:

```text
submission.zip
└── (root of ZIP)
    ├── pom.xml
    └── src/
        ├── main/
        │   └── java/
        │       └── ...
        └── test/
            └── java/
                └── ...
```

**Important:**
There must not be an extra top-level folder like `simple-math/` or `project/`.

This is **wrong**:

```text
submission.zip
└── simple-math/        ❌ extra wrapping folder
    ├── pom.xml
    └── src/...
```

### 1.2. Expected layout (Java / Maven)

Inside the project, use the standard Maven layout:

```text
pom.xml
src/
  main/
    java/
      com/
        example/
          kata/
            Calculator.java
  test/
    java/
      com/
        example/
          kata/
            CalculatorTest.java
```

- `src/main/java` → implementation (student's solution)
- `src/test/java` → tests (for now, the student ZIP still contains tests; in a "professor-only tests" model, these would come from the PIT archive instead).

### 1.3. pom.xml requirements

The `pom.xml` must:
- Declare Java 17 (or compatible with the runner's JDK).
- Include JUnit 5 (Jupiter) as test dependency.
- Ensure tests run with `mvn test` (default Surefire configuration is fine).

**Minimal example:**

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                             http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>org.uoc.tfm</groupId>
  <artifactId>simple-math</artifactId>
  <version>1.0.0</version>

  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
  </properties>

  <dependencies>
    <!-- JUnit 5 -->
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.10.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <!-- Ensure JUnit 5 is used by surefire -->
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.2.5</version>
        <configuration>
          <useModulePath>false</useModulePath>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

### 1.4. How students should build the ZIP

From the project root folder:

```bash
zip -r submission.zip pom.xml src
```

Upload that ZIP as the submission.

---

## 2. Professor PIT Tests ZIP

Each PIT (activity / assignment) can have its own set of professor tests uploaded from the admin panel.

When the professor selects a PIT and uploads a file from the panel:
- The backend saves the ZIP to S3 with the key:
  ```
  pits/<pitId>/tests.zip
  ```
- And registers the path in `pits.testsS3Key`.

### 2.1. Expected structure of the tests ZIP

Like the student project, the professor's ZIP must also be a Maven project at the root:

```text
tests.zip
└── (root of ZIP)
    ├── pom.xml
    └── src/
        └── test/
            └── java/
                └── ...
```

For example, for a "Simple Math" kata:

```text
pom.xml
src/
  test/
    java/
      org/
        uoc/
          tfm/
            SimpleMathTest.java
```

💡 **The test package structure must match the student's code packages**
(e.g., both under `org.uoc.tfm`), so the tests can import the solution classes.

### 2.2. Professor's pom.xml content

There are two possible models (depending on PIT design):

1. **Complete professor project (pom + dependencies + tests)**
   - The professor's `pom.xml` already defines everything needed (JUnit, etc.).
   - The runner could use this `pom.xml` as base and add the student's `src/main`.

2. **Tests only, reusing student's pom.xml**
   - The professor's ZIP would contain only `src/test/java/**`.
   - The runner would keep the student's `pom.xml` and only "inject" the tests.

⚠️ **Currently, the MVP executes `mvn test` as-is on the submission ZIP project.**
The use of `testsS3Key` and combining "student code + professor tests" is planned as a future enhancement.

---

## 3. Execution flow in the Runner (overview)

1. Student uploads a `submission.zip`.
2. The API:
   - Creates an entry in `submissions`.
   - Uploads the ZIP to S3.
   - Sends a message to SQS queue with `submissionId`, `pitId`, `fileKey`, etc.
3. The Runner:
   - Downloads the submission ZIP.
   - Extracts it to `/app/work/<submissionId>/`.
   - (Future optional) Downloads `pits/<pitId>/tests.zip`, extracts and combines tests.
   - Executes:
     ```bash
     mvn -q test
     ```
   - Parses Maven Surefire output, e.g.:
     ```
     Tests run: 4, Failures: 1, Errors: 0, Skipped: 0
     ```
   - Calculates:
     ```
     totalTests  = 4
     failedTests = 1
     passedTests = 3
     score       = 75 (3/4 * 100)
     ```
   - Uploads logs to S3 (`logs/<submissionId>/run.log`).
   - Updates the `submissions` row with `status`, `score`, `feedback`, and `logsS3Key`.

---

## 4. Quick summary (checklist)

### For students

- ✅ The ZIP contains `pom.xml` at the root (not inside another folder).
- ✅ Code is in `src/main/java/**`.
- ✅ (Current MVP) Tests are in `src/test/java/**` and pass locally with `mvn test`.
- ✅ The project compiles and runs tests locally before zipping.

### For professors (PIT tests)

- ✅ The ZIP has `pom.xml` and/or `src/test/java/**` at the root.
- ✅ Test package structure matches the student code structure.
- ✅ The ZIP passes `mvn test` locally when combined with a valid solution.
- ✅ The ZIP is uploaded through the PITs panel; the system saves it as `pits/<pitId>/tests.zip`.

---

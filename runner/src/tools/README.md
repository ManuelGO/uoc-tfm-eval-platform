# PIT Generator CLI Tool

Quick reference for the PIT Configuration Generator.

## Usage

### Interactive Mode (Recommended)

```bash
npm run generate:pit
```

The tool will prompt you for all required and optional fields.

### Non-Interactive Mode

```bash
npm run generate:pit -- \
  --id=<pitId> \
  --language=<language> \
  --buildTool=<buildTool> \
  --testCommand="<command>" \
  --maxTimeoutMs=<timeout> \
  [--setupCommands=<cmd1,cmd2>] \
  [--requiredFiles=<file1,file2>] \
  [--env=<KEY=VALUE,FOO=BAR>]
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--id` | Yes | - | PIT identifier (kebab-case, lowercase only) |
| `--language` | No | `java` | Programming language |
| `--buildTool` | No | `maven` | Build tool or package manager |
| `--testCommand` | No | `mvn -q test` | Command to run tests |
| `--maxTimeoutMs` | No | `60000` | Maximum timeout in milliseconds |
| `--setupCommands` | No | - | Comma-separated setup commands |
| `--requiredFiles` | No | - | Comma-separated required files |
| `--env` | No | - | Environment variables (KEY=VALUE,FOO=BAR) |
| `--environment` | No | - | Alias for `--env` |

## Examples

### Minimal Java/Maven PIT

```bash
npm run generate:pit -- --id=java-maven-simple-v1
```

### Complete Configuration

```bash
npm run generate:pit -- \
  --id=java-maven-bank-account-v1 \
  --language=java \
  --buildTool=maven \
  --testCommand="mvn -q test" \
  --maxTimeoutMs=60000 \
  --setupCommands="mvn -q clean compile" \
  --requiredFiles="pom.xml,src/" \
  --env="JAVA_HOME=/usr/lib/jvm/java-17,MAVEN_OPTS=-Xmx512m"
```

### Python Project with pytest

```bash
npm run generate:pit -- \
  --id=python-pytest-calculator-v1 \
  --language=python \
  --buildTool=pip \
  --testCommand="pytest -v" \
  --maxTimeoutMs=45000 \
  --setupCommands="pip install -q -r requirements.txt" \
  --requiredFiles="requirements.txt,tests/" \
  --env="PYTHONPATH=.,TEST_MODE=1"
```

### JavaScript/Node.js with npm

```bash
npm run generate:pit -- \
  --id=javascript-npm-todo-v1 \
  --language=javascript \
  --buildTool=npm \
  --testCommand="npm test" \
  --maxTimeoutMs=30000 \
  --setupCommands="npm install --silent" \
  --requiredFiles="package.json" \
  --env="NODE_ENV=test"
```

## Features

- ✅ **Interactive mode** with prompts and validation
- ✅ **Non-interactive mode** for scripts and automation
- ✅ **Input validation** (PIT ID format, timeout limits, etc.)
- ✅ **Overwrite protection** (prompts in interactive mode, fails in non-interactive)
- ✅ **Type-safe** - uses the official PitConfig interface
- ✅ **Environment variables** support with KEY=VALUE format
- ✅ **Helpful output** with next steps and usage examples

## Output

The generator creates a JSON file at `runner/pits/<pitId>.json` and displays:

1. Configuration summary
2. File location
3. Next steps for deployment
4. Example API usage

## Validation Rules

### PIT ID
- Must be lowercase
- Only alphanumeric characters and hyphens
- No consecutive, leading, or trailing hyphens
- Example: `java-maven-bank-account-v1`

### Timeout
- Must be a positive integer
- Maximum: 600000ms (10 minutes)
- Recommended: 60000ms (1 minute) for unit tests

### Supported Languages
- `java`, `python`, `javascript`, `typescript`
- Others accepted with warning

### Supported Build Tools
- `maven`, `gradle`, `npm`, `pip`, `poetry`
- Others accepted with warning

## Troubleshooting

### File Already Exists

**Interactive mode:** You'll be prompted to overwrite (yes/no)

**Non-interactive mode:** The tool will fail with an error. Use interactive mode to overwrite or delete the file manually.

### Invalid PIT ID

Ensure your PIT ID follows the naming convention:
- `<language>-<buildTool>-<exercise-name>-v<version>`
- Example: `java-maven-calculator-v1`

### Environment Variables Not Parsing

Use the correct format: `KEY=VALUE,KEY2=VALUE2`

**Correct:**
```bash
--env="JAVA_HOME=/usr/lib/jvm/java-17,MAVEN_OPTS=-Xmx512m"
# OR
--environment="JAVA_HOME=/usr/lib/jvm/java-17,MAVEN_OPTS=-Xmx512m"
```

**Incorrect:**
```bash
--env="JAVA_HOME /usr/lib/jvm/java-17, MAVEN_OPTS -Xmx512m"
```

**Validation Rules:**
- Each pair must have the format `KEY=VALUE`
- Keys cannot be empty
- Values can be empty (e.g., `KEY=`)
- Invalid pairs are skipped with a warning
- Spaces around keys and values are automatically trimmed

**Example with warnings:**
```bash
npm run generate:pit -- \
  --id=test-v1 \
  --env="VALID=value,INVALID_NO_EQUALS,=empty_key,GOOD=123"
# Output:
# Warning: Ignoring invalid env pair "INVALID_NO_EQUALS" (expected KEY=VALUE)
# Warning: Ignoring env pair with empty key "=empty_key"
# Result: Only VALID and GOOD are saved
```

## See Also

- [PIT-CONFIGS.md](../../PIT-CONFIGS.md) - Complete documentation on PIT configurations
- [pit-config.interface.ts](../pit-config/interfaces/pit-config.interface.ts) - TypeScript interface definition

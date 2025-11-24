# PIT Configurations

This directory contains configuration files for different Programming Interactive Tasks (PITs).

## Configuration Format

Each PIT has its own JSON configuration file named `{pitId}.json`.

### Required Fields

- **language**: Programming language (e.g., "java", "python", "javascript")
- **buildTool**: Build tool or package manager (e.g., "maven", "gradle", "npm")
- **testCommand**: Command to execute tests
- **maxTimeoutMs**: Maximum execution timeout in milliseconds

### Optional Fields

- **setupCommands**: Array of commands to run before test execution (e.g., dependency installation)
- **environment**: Environment variables to set during execution
- **requiredFiles**: Files or directories that must be present in the submission

## Example Configuration

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

## Available Configurations

- **sample-pit.json**: Java Maven project with JUnit tests

## Adding New PITs

1. Create a new JSON file with the PIT ID as filename (e.g., `python-unittest.json`)
2. Define all required fields according to the PIT's requirements
3. Test the configuration by running a sample submission
4. Document any specific requirements or dependencies

## Notes

- Configuration files are loaded and validated at runtime
- Invalid configurations will prevent submission processing
- Configurations are cached after first load for performance

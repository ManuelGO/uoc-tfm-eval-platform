# PIT Configs & Generator

Este documento explica:

- Qué es una configuración PIT (`PitConfig`)
- Dónde se guardan los `.json`
- Cómo usar el generador CLI en modo interactivo y no interactivo

---

## 1. ¿Qué es un PIT Config?

Cada **PIT (Programming Interactive Task)** tiene una configuración asociada que el **Runner** usa para saber:

- Qué lenguaje y herramientas usa (`language`, `buildTool`)
- Qué comando ejecutar para los tests (`testCommand`)
- Cuánto tiempo máximo dejar correr los tests (`maxTimeoutMs`)
- Opcionalmente:
  - Comandos de setup previos (`setupCommands`)
  - Variables de entorno (`environment`)
  - Ficheros requeridos (`requiredFiles`)

La interfaz TypeScript es:

```ts
export interface PitConfig {
  language: string;
  buildTool: string;
  testCommand: string;
  maxTimeoutMs: number;
  setupCommands?: string[];
  environment?: Record<string, string>;
  requiredFiles?: string[];
}
```

---

## 2. Dónde van los JSON

El Runner carga las configs desde:

```
runner/pits/<pitId>.json
```

- `<pitId>` es un ID que tú decides (ej: `java-maven-basic`).
- En runtime, el Runner usa este `pitId` que viene en la submission para localizar el fichero:

```typescript
// Runner
configPath = resolve('./pits', `${pitId}.json`);
```

Por tanto:
- Si el `pitId` de la submission es: `11111111-1111-1111-1111-111111111111`
- El Runner buscará: `runner/pits/11111111-1111-1111-1111-111111111111.json` dentro del contenedor.

---

## 3. Generador de PITs (CLI)

El generador está en:
```
runner/src/tools/pit-generator.ts
```

Y se ejecuta vía npm desde la carpeta `runner`.

### 3.1. Modo interactivo (recomendado)

Desde `runner/`:

```bash
cd runner
npm run generate:pit
```

Esto lanzará un asistente por consola:

- **PIT ID (required)**
  - Debe contener solo: minúsculas, números y guiones (`-`)
  - No puede empezar/terminar con `-`
  - No puede tener `--` seguidos
  - Ejemplos válidos:
    - `java-maven-basic`
    - `python-pip-factorial`
    - `ts-jest-demo`
- **Language** (por defecto: `java`)
- **Build Tool** (por defecto: `maven`)
- **Test Command** (por defecto: `mvn -q test`)
- **Max Timeout (ms)** (por defecto: `60000`)
- **Setup Commands** (opcional, coma-separados)
- **Required Files** (opcional, coma-separados)
- **Environment Variables** (opcional, formato: `KEY=VALUE,FOO=BAR`)

El generador creará:
```
runner/pits/<pitId>.json
```

Output esperado:
```
=== PIT Configuration Generated ===

PIT ID:       java-maven-basic
Output Path:  /.../runner/pits/java-maven-basic.json
Language:     java
Build Tool:   maven
Test Command: mvn -q test
Timeout:      60000ms
```

Si el fichero ya existe, en modo interactivo preguntará:
```
File already exists: runner/pits/java-maven-basic.json
Overwrite? (yes/no):
```

### 3.2. Modo no interactivo (CLI flags)

También puedes generar un PIT config directamente con flags:

```bash
cd runner

npm run generate:pit -- \
  --id=java-maven-basic \
  --language=java \
  --buildTool=maven \
  --testCommand="mvn -q test" \
  --maxTimeoutMs=60000 \
  --requiredFiles=pom.xml,src \
  --setupCommands="mvn -q test-compile" \
  --env=JAVA_TOOL_OPTIONS=-Xmx512m,FOO=bar
```

**Flags soportados:**
- `--id=` (obligatorio)
- `--language=` (opcional, defecto: `java`)
- `--buildTool=` (opcional, defecto: `maven`)
- `--testCommand=` (opcional, defecto: `mvn -q test`)
- `--maxTimeoutMs=` (opcional, defecto: `60000`)
- `--setupCommands=a,b,c` (opcional)
- `--requiredFiles=f1,f2` (opcional)
- `--env=KEY=VALUE,FOO=BAR` o `--environment=...` (opcional)

**Notas:**
- Si el timeout es inválido o > 600000 ms, el script falla con mensaje claro.
- Si ya existe el fichero en modo no interactivo, el script termina con error para evitar sobrescribir sin querer.

---

## 4. Ejemplo completo: Dummy Java PIT

Supongamos que tenemos un ejercicio Java con:
- `pom.xml` con tests JUnit
- Código en `src/main/java/...`
- Tests en `src/test/java/...`

Podemos crear un PIT así:

```bash
cd runner

npm run generate:pit -- \
  --id=java-maven-dummy \
  --language=java \
  --buildTool=maven \
  --testCommand="mvn -q test" \
  --maxTimeoutMs=60000 \
  --requiredFiles=pom.xml,src \
  --env=JAVA_TOOL_OPTIONS=-Xmx512m
```

Esto generará `runner/pits/java-maven-dummy.json`:

```json
{
  "language": "java",
  "buildTool": "maven",
  "testCommand": "mvn -q test",
  "maxTimeoutMs": 60000,
  "requiredFiles": ["pom.xml", "src"],
  "environment": {
    "JAVA_TOOL_OPTIONS": "-Xmx512m"
  }
}
```

En la API, cuando crees una submission para este ejercicio, usarás:

```json
{
  "pitId": "java-maven-dummy",
  "fileKey": "submissions/<userId>/java-maven-dummy/<timestamp>.zip"
}
```

El Runner:
1. Descarga y extrae el ZIP a `/app/work/<submissionId>`.
2. Carga `/app/pits/java-maven-dummy.json`.
3. Ejecuta el comando `mvn -q test` en ese workspace.
4. Aplica `environment` y `setupCommands` si están definidos.
5. Envía resultados a la base de datos y logs a S3.

---

## 5. Buenas prácticas

- **Usa IDs legibles y estables:**
  - `java-maven-array-ops`
  - `python-pip-fizzbuzz`
- **Usa `requiredFiles` para evitar ZIPs inválidos:**
  - `["pom.xml", "src"]` para Java/Maven.
- **Ajusta `maxTimeoutMs` según el peso de los tests.**
- **Usa `environment` para configuraciones de runtime específicas:**
  - Ej: `JAVA_TOOL_OPTIONS=-Xmx512m`
- **Si cambias la forma de ejecutar tests de un PIT**, genera un nuevo JSON (o revisa el existente con el generador en modo interactivo).

---

## 6. Validación de configuraciones

El generador incluye validación automática:

### PIT ID
- **Formato válido:** Solo minúsculas, números y guiones
- **Restricciones:** No puede empezar/terminar con `-`, ni tener `--` consecutivos
- **Ejemplos válidos:** `java-maven-v1`, `python-pytest-calc`
- **Ejemplos inválidos:** `Java-Maven`, `test--pit`, `-invalid`

### Timeout
- **Rango:** 1 - 600000ms (10 minutos)
- **Recomendado:** 60000ms (1 minuto) para tests unitarios
- **Error si:** `<= 0` o `> 600000`

### Environment Variables
- **Formato:** `KEY=VALUE,FOO=BAR`
- **Validación:**
  - Cada par debe tener `=`
  - Las keys no pueden estar vacías
  - Los valores pueden estar vacíos (`KEY=` es válido)
  - Pares inválidos se ignoran con warning

**Ejemplo con warnings:**
```bash
npm run generate:pit -- \
  --id=test-v1 \
  --env="VALID=value,INVALID_NO_EQUALS,=empty_key"

# Output:
# Warning: Ignoring invalid env pair "INVALID_NO_EQUALS" (expected KEY=VALUE)
# Warning: Ignoring env pair with empty key "=empty_key"
# Resultado: Solo "VALID" se guarda
```

---

## 7. Soporte de múltiples lenguajes

### Java + Maven

```bash
npm run generate:pit -- \
  --id=java-maven-exercise-v1 \
  --language=java \
  --buildTool=maven \
  --testCommand="mvn -q test" \
  --maxTimeoutMs=60000 \
  --setupCommands="mvn -q clean compile" \
  --requiredFiles="pom.xml,src/" \
  --env="JAVA_HOME=/usr/lib/jvm/java-17,MAVEN_OPTS=-Xmx512m"
```

### Python + pytest

```bash
npm run generate:pit -- \
  --id=python-pytest-exercise-v1 \
  --language=python \
  --buildTool=pip \
  --testCommand="pytest -v" \
  --maxTimeoutMs=45000 \
  --setupCommands="pip install -q -r requirements.txt" \
  --requiredFiles="requirements.txt,tests/" \
  --env="PYTHONPATH=.,TEST_MODE=1"
```

### JavaScript + npm

```bash
npm run generate:pit -- \
  --id=javascript-npm-exercise-v1 \
  --language=javascript \
  --buildTool=npm \
  --testCommand="npm test" \
  --maxTimeoutMs=30000 \
  --setupCommands="npm install --silent" \
  --requiredFiles="package.json" \
  --env="NODE_ENV=test"
```

---

## 8. Troubleshooting

### Error: "PIT configuration file not found"

**Causa:** El `pitId` en la submission no coincide con ningún archivo `.json` en `runner/pits/`

**Solución:**
1. Verifica que el archivo existe: `ls runner/pits/`
2. Asegúrate de que el nombre del archivo coincide exactamente con el `pitId`
3. Verifica que el archivo fue copiado al contenedor Docker

### Error: "File already exists"

**En modo interactivo:** Se pregunta si sobrescribir (yes/no)

**En modo no interactivo:** El comando falla para proteger el archivo existente

**Solución:**
- Usa modo interactivo para sobrescribir
- O elimina el archivo manualmente: `rm runner/pits/<pitId>.json`

### Warning: "Ignoring invalid env pair"

**Causa:** Una variable de entorno no tiene el formato correcto

**Solución:**
- Usa siempre `KEY=VALUE`
- Separa múltiples variables con comas: `KEY1=val1,KEY2=val2`
- Asegúrate de que las keys no estén vacías

### Tests timeout constantemente

**Causa:** `maxTimeoutMs` es insuficiente para los tests

**Solución:**
1. Aumenta el timeout en el config
2. Regenera con: `npm run generate:pit` (modo interactivo)
3. O edita manualmente el archivo JSON

---

## 9. Integración con la API

Para que un PIT funcione end-to-end:

1. **Generar el config del Runner:**
   ```bash
   npm run generate:pit -- --id=mi-ejercicio-v1 ...
   ```

2. **Registrar el PIT en la base de datos:**
   ```sql
   INSERT INTO pits (id, code, title, description, active)
   VALUES (
     'mi-ejercicio-v1',  -- Debe coincidir con el archivo JSON!
     'MI_EJERCICIO',
     'Mi Ejercicio v1',
     'Descripción del ejercicio',
     true
   );
   ```

   O usando un seed service:
   ```typescript
   // api/src/pits/mi-ejercicio-pit.seed.service.ts
   await this.pitRepository.save({
     id: 'mi-ejercicio-v1',  // Debe coincidir!
     code: 'MI_EJERCICIO',
     title: 'Mi Ejercicio v1',
     description: 'Descripción del ejercicio',
     active: true,
   });
   ```

3. **Crear una submission:**
   ```http
   POST /submissions/confirm
   {
     "pitId": "mi-ejercicio-v1",
     "userId": "...",
     "fileKey": "..."
   }
   ```

4. **El Runner procesará:**
   - Carga `runner/pits/mi-ejercicio-v1.json`
   - Descarga el ZIP de S3
   - Ejecuta tests según la config
   - Actualiza la base de datos con resultados

**IMPORTANTE:** El `id` en la base de datos DEBE coincidir exactamente con el nombre del archivo JSON (sin extensión).

---

## Ver también

- [pit-generator.ts](src/tools/pit-generator.ts) - Código fuente del generador
- [pit-config.interface.ts](src/pit-config/interfaces/pit-config.interface.ts) - Interfaz TypeScript
- [tools/README.md](src/tools/README.md) - Guía rápida del generador

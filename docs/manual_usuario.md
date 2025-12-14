# Manual de Usuario
Plataforma de Evaluación Automática de Código

## 1. Introducción

Esta plataforma permite a estudiantes enviar soluciones de programación en formato `.zip` para que sean evaluadas automáticamente mediante tests unitarios definidos por el profesor. El sistema ejecuta los tests, analiza los resultados y proporciona feedback inmediato.

## 2. Acceso a la plataforma

El acceso se realiza mediante un sistema de autenticación sin contraseña (magic link):

1. El usuario introduce su correo electrónico.
2. Recibe un enlace por email.
3. Al abrir el enlace, accede automáticamente a la plataforma.

No es necesario recordar contraseñas.

## 3. Vista principal

Una vez autenticado, el usuario puede:

- Ver los PITs (actividades) disponibles.
- Seleccionar una actividad.
- Subir una solución para ser evaluada.

## 4. Subida de una solución

Para enviar una solución:

1. El usuario selecciona un PIT.
2. Sube un archivo `.zip` con su solución.
3. El sistema valida el archivo y confirma la subida.

El archivo debe contener únicamente el código fuente del estudiante, sin tests.

## 5. Proceso de evaluación

Tras la subida:

1. La solución se envía al servidor.
2. Se ejecutan los tests del profesor en un entorno aislado.
3. El sistema analiza los resultados.
4. Se calcula una puntuación basada en los tests superados.

Este proceso es automático y asíncrono.

## 6. Visualización de resultados

El usuario puede ver:

- Estado de la evaluación (en progreso, completada, error).
- Número de tests ejecutados.
- Tests superados y fallidos.
- Puntuación final.
- Logs de ejecución (si están disponibles).

## 7. Consideraciones finales

La plataforma está pensada como una herramienta de apoyo al aprendizaje, proporcionando feedback rápido y objetivo sobre las soluciones entregadas.
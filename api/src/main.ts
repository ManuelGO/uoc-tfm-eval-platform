// IMPORTANT: Import polyfills FIRST before any other modules
import './polyfills';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔐 CORS para permitir llamadas desde el frontend Angular en dev
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  const port =
    (process.env.API_PORT && Number(process.env.API_PORT)) ||
    (process.env.PORT && Number(process.env.PORT)) ||
    3000;

  await app.listen(port, '0.0.0.0');
  console.log(`✅ API running on http://0.0.0.0:${port}`);
}

// IMPORTANT: call bootstrap and log any error
bootstrap().catch((err) => {
  console.error('❌ Failed to start NestJS application', err);
  process.exit(1);
});

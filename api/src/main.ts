import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

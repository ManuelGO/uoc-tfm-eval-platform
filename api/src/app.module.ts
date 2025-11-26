import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PitsModule } from './pits/pits.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const rawDatabaseUrl = process.env.DATABASE_URL;
        const hasDatabaseUrl =
          typeof rawDatabaseUrl === 'string' &&
          rawDatabaseUrl.trim().length > 0;

        const sslEnabled = process.env.DB_SSL === 'true';

        if (hasDatabaseUrl) {
          const databaseUrl = rawDatabaseUrl.trim();

          console.log('✅ Using DATABASE_URL for TypeORM connection', {
            databaseUrl,
            sslEnabled,
          });

          return {
            type: 'postgres' as const,
            url: databaseUrl,
            ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
            autoLoadEntities: true,
            synchronize: true,
          };
        }

        const host = process.env.DB_HOST;
        const port = process.env.DB_PORT
          ? Number.parseInt(process.env.DB_PORT, 10)
          : 5432;
        const username = process.env.DB_USER;
        const password = process.env.DB_PASS;
        const database = process.env.DB_NAME;

        console.log('✅ Using host-based DB config', {
          host,
          port,
          username,
          database,
          sslEnabled,
        });

        if (!host || !username || !database) {
          throw new Error('DB config is incomplete (DB_HOST/DB_USER/DB_NAME)');
        }

        return {
          type: 'postgres' as const,
          host,
          port,
          username,
          password,
          database,
          ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),

    UsersModule,
    PitsModule,
    SubmissionsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

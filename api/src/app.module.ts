import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

    // 🔗 DB connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const dbSsl = config.get<string>('DB_SSL');
        const isSslEnabled = dbSsl === 'true';

        const baseConfig = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: true, // OK for dev
        };

        // RDS / production style using DATABASE_URL
        if (databaseUrl) {
          console.log(
            '✅ DB config: Using DATABASE_URL with SSL:',
            isSslEnabled,
          );
          return {
            ...baseConfig,
            url: databaseUrl,
            ssl: isSslEnabled
              ? { rejectUnauthorized: false } // OK for RDS, avoids CA issues
              : undefined,
          };
        }

        // Local/dev style using individual env vars
        const host = config.get<string>('DB_HOST');
        const port = Number(config.get<string>('DB_PORT') || 5432);
        const username = config.get<string>('DB_USER');
        const password = config.get<string>('DB_PASS');
        const database = config.get<string>('DB_NAME');

        console.log('✅ DB config', {
          host,
          port,
          username,
          database,
          ssl: isSslEnabled,
        });

        if (!host || !username || !database) {
          throw new Error('DB config is incomplete (DB_HOST/DB_USER/DB_NAME)');
        }

        return {
          ...baseConfig,
          host,
          port,
          username,
          password,
          database,
          ssl: isSslEnabled ? { rejectUnauthorized: false } : undefined,
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
/*
Nota: synchronize: true para desarrollo/TFM es aceptable.
(Puedes explicarlo en la memoria: “para simplificar el entorno de desarrollo, se usa el sincronizador automático de TypeORM”).
*/

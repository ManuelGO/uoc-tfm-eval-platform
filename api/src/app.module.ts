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
        const host = config.get<string>('DB_HOST');
        const port = Number(config.get<string>('DB_PORT') || 5432);
        const username = config.get<string>('DB_USER');
        const password = config.get<string>('DB_PASS');
        const database = config.get<string>('DB_NAME');
        console.log('✅ DB config', { host, port, username, database });
        if (!host || !username || !database) {
          throw new Error('DB config is incomplete (DB_HOST/DB_USER/DB_NAME)');
        }
        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,
          autoLoadEntities: true,
          synchronize: true, // OK for dev
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

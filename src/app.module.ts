/**
 * Módulo principal de la aplicación
 * 
 * Aquí se registran todos los módulos que usa la aplicación:
 * - ConfigModule: Para leer variables de entorno (.env)
 * - TypeOrmModule: Para conexión a PostgreSQL
 * - JacModule: Nuestro módulo de JACs
 * - RabbitMQModule: Para comunicación entre microservicios
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JacModule } from './jac/jac.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RolesGuard } from './auth/roles.guard';
import { AfiliadosModule } from './afiliados/afiliados.module';
import { AsocomunalModule } from './asocomunal/asocomunal.module';

@Module({
  imports: [
    // ConfigModule: Carga las variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,              // Disponible en toda la app
      envFilePath: '.env',         // Archivo de configuración
    }),
    
    // TypeOrmModule: Conexión a PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',                              // Tipo de BD
        host: configService.get<string>('DB_HOST'),    // Host desde .env
        port: configService.get<number>('DB_PORT'),    // Puerto desde .env
        username: configService.get<string>('DB_USER'),// Usuario desde .env
        password: configService.get<string>('DB_PASSWORD'), // Contraseña
        database: configService.get<string>('DB_NAME'),// Nombre de BD
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // Entidades (tablas)
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        // synchronize: true solo en desarrollo (crea tablas automáticamente)
        // En producción usar migraciones
      }),
      inject: [ConfigService],
    }),
    
    // Módulos de la aplicación
    JacModule,
    AfiliadosModule,
    AsocomunalModule,
    RabbitMQModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
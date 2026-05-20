import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * Cola para recibir eventos de sincronización de Asocomunales (MS1)
   */
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'colaAsocomunales',
      queueOptions: {
        durable: true,
      },
    },
  });

  /**
   * Cola para recibir aprobaciones de JAC desde el MS de Auditoría
   */
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
      queue: 'colaAprobacionesJAC',
      queueOptions: {
        durable: true,
      },
    },
  });

  // Validación global de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // lanza 400 si llegan propiedades no permitidas
      transform: true, // convierte tipos automáticamente (ej. @Type(() => Number))
    }),
  );

  // Habilitar lectura de cookies (necesario para el guard JWT)
  app.use(cookieParser());

  // COnfiguracion CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT || 3001);
}
bootstrap().catch((error: unknown) => {
  const errorMessage =
    error instanceof Error ? error.message : JSON.stringify(error);
  console.error('Error durante el arranque de la aplicación:', errorMessage);
  process.exit(1);
});

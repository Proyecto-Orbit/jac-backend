import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * Esto es lo que permite consumir eventos
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

  await app.startAllMicroservices(); 
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
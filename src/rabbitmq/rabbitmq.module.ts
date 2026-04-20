/**
 * Módulo de RabbitMQ para comunicación entre microservicios
 * 
 * Configura dos colas:
 * 1. JAC_PROVIDER_SERVICE: Para enviar eventos de JAC → Asocomunales
 * 2. ASOCOMUNALES_CONSUMER_SERVICE: Para recibir eventos de Asocomunales → JAC
 * 
 * @decorator @Global() - Disponible en toda la aplicación sin importar en cada módulo
 */
import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        // Cliente para enviar eventos a Asocomunales
        name: 'JAC_PROVIDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
            transport: Transport.RMQ,
            options: {
                urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
                queue: 'colaJac',
                queueOptions: {
                    durable: true,
                },
            },
        }),
        inject: [ConfigService],
      },
      {
        // Servidor para recibir eventos de Asocomunales
        name: 'ASOCOMUNALES_CONSUMER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
            transport: Transport.RMQ,
            options: {
                urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
                queue: 'colaAsocomunales',
                queueOptions: {
                    durable: true,
                },
            },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  // Registrar RabbitMQService como provider
  providers: [RabbitMQService],
  // Exportarlo para que otros módulos lo usen
  exports: [RabbitMQService, ClientsModule],
})
export class RabbitMQModule {}
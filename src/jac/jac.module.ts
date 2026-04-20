/**
 * Módulo de JAC
 * 
 * Agrupa todos los componentes relacionados con JACs:
 * - Entity (tabla en BD)
 * - Service (lógica de negocio)
 * - Controller (endpoints HTTP)
 * - DTOs (validación de datos)
 * 
 * Importa RabbitMQModule para poder notificar eventos
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JAC } from './entities/jac.entity';
import { JacService } from './jac.service';
import { JacController } from './jac.controller';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RabbitMQController } from '../rabbitmq/rabbitmq.controller';
import { JacConsumer } from './infrastructure/messaging/jac.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([JAC]), // Registrar entidad
    RabbitMQModule,                   // Para notificaciones
  ],
  controllers: [JacController,
    JacConsumer, // Para consumir eventos de Asocomunal
    RabbitMQController,
  ],
  providers: [JacService],
  exports: [JacService], // Disponible para otros módulos
})
export class JacModule {}
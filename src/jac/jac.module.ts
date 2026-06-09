import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JAC } from './entities/jac.entity';
import { Persona } from '../afiliados/entities/persona.entity';
import { JacService } from './jac.service';
import { JacController } from './jac.controller';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RabbitMQController } from '../rabbitmq/rabbitmq.controller';
import { AsocomunalModule } from '../asocomunal/asocomunal.module';
import { AfiliadosModule } from '../afiliados/afiliados.module';

/**
 * Módulo principal de JAC.
 *
 * @remarks
 * Agrupa todos los componentes del dominio JAC:
 * - {@link JacController} — endpoints HTTP REST.
 * - {@link JacService} — lógica de negocio.
 * - {@link RabbitMQController} — consumidor de eventos de Asocomunales.
 *
 * Importa {@link AsocomunalModule} para que {@link RabbitMQController}
 * pueda persistir los eventos de Asocomunales recibidos vía RabbitMQ.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JAC, Persona]),
    RabbitMQModule,
    AsocomunalModule,
    AfiliadosModule,
  ],
  controllers: [
    JacController,
    RabbitMQController,
  ],
  providers: [JacService],
  exports: [JacService],
})
export class JacModule {}

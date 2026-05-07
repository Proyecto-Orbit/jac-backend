import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asocomunal } from './entities/asocomunal.entity';
import { AsocomunalService } from './asocomunal.service';
import { AsocomunalController } from './asocomunal.controller';

/**
 * Módulo de réplica de Asocomunales.
 *
 * @remarks
 * Expone un controlador HTTP de solo lectura para obtener la lista de réplicas.
 * La entidad {@link Asocomunal} se sincroniza a través de eventos RabbitMQ.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Asocomunal])],
  controllers: [AsocomunalController],
  providers: [AsocomunalService],
  exports: [AsocomunalService],
})
export class AsocomunalModule {}

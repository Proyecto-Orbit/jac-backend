import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asocomunal } from './entities/asocomunal.entity';
import { AsocomunalService } from './asocomunal.service';

/**
 * Módulo de réplica de Asocomunales.
 *
 * @remarks
 * No expone controladores HTTP. La entidad {@link Asocomunal} se gestiona
 * únicamente a través de eventos RabbitMQ consumidos en el módulo JAC.
 * Exporta {@link AsocomunalService} para que los consumidores de mensajes
 * puedan persistir los cambios recibidos.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Asocomunal])],
  providers: [AsocomunalService],
  exports: [AsocomunalService],
})
export class AsocomunalModule {}

import { Controller, Get } from '@nestjs/common';
import { AsocomunalService } from './asocomunal.service';
import { Asocomunal } from './entities/asocomunal.entity';

/**
 * Controlador para la réplica de Asocomunales.
 * 
 * Expone la información sincronizada desde el microservicio de Asocomunales.
 * Estos datos son de solo lectura para el exterior, ya que su actualización
 * ocurre vía RabbitMQ.
 */
@Controller('asocomunal')
export class AsocomunalController {
  constructor(private readonly asocomunalService: AsocomunalService) {}

  /**
   * Obtiene la lista completa de asocomunales en la réplica local.
   * GET /asocomunal
   */
  @Get()
  async findAll(): Promise<Asocomunal[]> {
    return this.asocomunalService.findAll();
  }
}

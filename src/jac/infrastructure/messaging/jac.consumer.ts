import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

/**
 * Consumer de eventos externos (Asocomunal → JAC)
 * Responsabilidad: reaccionar a eventos del dominio externo
 */
@Controller()
export class JacConsumer {
  private readonly logger = new Logger(JacConsumer.name);

  /**
   * Maneja la creación de una Asocomunal
   * Debe coincidir EXACTAMENTE con el evento publicado
   */
  @EventPattern('asocomunal.created.event')
  async handleAsocomunalCreated(@Payload() data: any) {
    this.logger.log('Evento recibido desde Asocomunal');

    try {
      // Aquí puedes mapear a DTO seguro si quieres
      this.logger.debug(JSON.stringify(data));

      // TODO: lógica de dominio (ej: asociar JACs)

    } catch (error) {
      this.logger.error('Error procesando evento', error);
    }
  }
}
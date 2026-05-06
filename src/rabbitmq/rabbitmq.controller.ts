import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  AsocomunalService,
  AsocomunalEventPayload,
} from '../asocomunal/asocomunal.service';

/**
 * Payload de un evento de Asocomunal recibido por RabbitMQ.
 *
 * @remarks
 * La propiedad `action` determina la operación a realizar sobre la
 * réplica local. El resto de los campos son los datos del registro.
 */
interface AsocomunalEventDto extends AsocomunalEventPayload {
  /** Tipo de operación que originó el evento. */
  action: 'created' | 'updated' | 'deleted';
}

/**
 * Payload de una confirmación de evento JAC recibido por RabbitMQ.
 */
interface JACEventDto {
  /** Identificador de la JAC. */
  id: number;
  /** Nombre de la JAC. */
  nombre: string;
  /** Estado actual de la JAC. */
  estado: boolean;
  /** ID de la Asocomunal vinculada, si existe. */
  asocomunalId: number | null;
  /** Tipo de operación confirmada. */
  action: 'created' | 'updated' | 'deleted';
}

/**
 * Controlador de consumo de mensajes RabbitMQ.
 *
 * @remarks
 * Escucha eventos publicados por el microservicio de Asocomunales y
 * los persiste en la tabla réplica local mediante {@link AsocomunalService}.
 * También registra las confirmaciones de eventos JAC para trazabilidad.
 *
 * No expone endpoints HTTP.
 */
@Controller()
export class RabbitMQController {
  private readonly logger = new Logger(RabbitMQController.name);

  constructor(private readonly asocomunalService: AsocomunalService) {}

  /**
   * Consume el patrón `asocomunal.event` de la cola RabbitMQ.
   *
   * @remarks
   * Delega la persistencia a {@link AsocomunalService}:
   * - `created` / `updated` → llama a `upsert()`.
   * - `deleted` → llama a `remove()`.
   *
   * Los errores se capturan y loguean sin relanzar, para no bloquear
   * el consumidor de la cola.
   *
   * @param data - Payload del evento publicado por el microservicio.
   */
  @EventPattern('asocomunal.event')
  async handleAsocomunalEvent(@Payload() data: AsocomunalEventDto): Promise<void> {
    this.logger.log(`Evento recibido de Asocomunales: action=${data.action}, id=${data.id}`);

    try {
      switch (data.action) {
        case 'created':
        case 'updated':
          await this.asocomunalService.upsert({
            id: data.id,
            nombre: data.nombre,
            municipioId: data.municipioId,
            municipioNombre: data.municipioNombre,
            estado: data.estado,
          });
          this.logger.log(`Asocomunal id=${data.id} sincronizada (${data.action})`);
          break;

        case 'deleted':
          await this.asocomunalService.remove(data.id);
          this.logger.log(`Asocomunal id=${data.id} eliminada de la réplica local`);
          break;

        default:
          this.logger.warn(`Acción desconocida recibida: ${String((data as AsocomunalEventDto).action)}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error procesando evento de Asocomunal id=${data.id}: ${msg}`);
    }
  }

  /**
   * Consume el patrón `jac.event` para registrar confirmaciones de JAC.
   *
   * @remarks
   * Actualmente solo registra el evento en el log. Puede extenderse para
   * sincronizar estado adicional si fuera necesario.
   *
   * @param data - Payload de confirmación publicado por el microservicio.
   */
  @EventPattern('jac.event')
  async handleJACEvent(@Payload() data: JACEventDto): Promise<void> {
    this.logger.log(`Confirmación JAC recibida: action=${data.action}, id=${data.id}`);

    try {
      switch (data.action) {
        case 'created':
          this.logger.log(`JAC creada confirmada: "${data.nombre}" (id=${data.id})`);
          break;
        case 'updated':
          this.logger.log(`JAC actualizada confirmada: "${data.nombre}" (id=${data.id})`);
          break;
        case 'deleted':
          this.logger.log(`JAC eliminada (lógico) confirmada: id=${data.id}`);
          break;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error procesando confirmación JAC id=${data.id}: ${msg}`);
    }
  }
}

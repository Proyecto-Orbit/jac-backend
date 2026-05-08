import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  AsocomunalService,
  AsocomunalEventPayload,
} from '../asocomunal/asocomunal.service';
import { JacService } from '../jac/jac.service';

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

  constructor(
    private readonly asocomunalService: AsocomunalService,
    private readonly jacService: JacService,
  ) {}

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

  @EventPattern('solicitud.aprobada.jac')
  async handleSolicitudAprobadaJac(@Payload() data: any): Promise<void> {
    this.logger.log(`Solicitud de JAC aprobada recibida: acción=${data.tipoAccion}`);

    try {
      const { tipoAccion, datos, entidadId } = data;

      switch (tipoAccion) {
        case 'CREAR':
          await this.jacService.create(datos);
          this.logger.log(`Nueva JAC creada tras aprobación: "${datos.nombreCompleto}"`);
          break;

        case 'EDITAR':
          if (entidadId) {
            await this.jacService.update(Number(entidadId), datos);
            this.logger.log(`JAC id=${entidadId} actualizada tras aprobación`);
          }
          break;

        case 'ELIMINAR':
          if (entidadId) {
            await this.jacService.remove(Number(entidadId));
            this.logger.log(`JAC id=${entidadId} eliminada tras aprobación`);
          }
          break;

        default:
          this.logger.warn(`Tipo de acción de solicitud desconocida: ${tipoAccion}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error aplicando solicitud aprobada de JAC: ${msg}`);
    }
  }
}

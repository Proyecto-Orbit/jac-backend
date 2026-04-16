/**
 * Servicio para publicar eventos a Asocomunales
 * 
 * Este servicio se encarga de enviar notificaciones cuando:
 * - Se crea una JAC
 * - Se actualiza una JAC
 * - Se desactiva una JAC
 * 
 * Los eventos se envían de forma ASÍNCRONA (fire-and-forget)
 * El microservicio de Asocomunales los consume cuando está disponible
 */
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientRMQ } from '@nestjs/microservices';

/**
 * DTO para eventos enviados a Asocomunales
 * 
 * Este formato fue acordado con el equipo de Asocomunales
 */
export interface JACEventDto {
  id: number;                    // ID de la JAC (number, no UUID)
  nombre: string;                // nombreCompletoJunta
  estado: boolean;               // ACTIVA === 'SI'
  asocomunalId: number | null;   // FK a Asocomunal
  action: 'created' | 'updated' | 'deleted';
  timestamp: Date;
}

@Injectable()
export class RabbitMQService implements OnModuleInit {
  constructor(
    @Inject('JAC_PROVIDER_SERVICE')
    private readonly jacProviderClient: ClientRMQ,
  ) {}

  /**
   * Conectar a RabbitMQ cuando el módulo se inicializa
   */
  async onModuleInit() {
    await this.jacProviderClient.connect();
  }

  /**
   * Publicar evento a la cola de Asocomunales
   * 
   * @param event - Datos del evento
   * @param pattern - Patrón del mensaje (jac.created.event, etc.)
   */
  private async publishEvent(event: JACEventDto, pattern: string): Promise<void> {
    try {
      await this.jacProviderClient.emit(pattern, event);
      console.log(`Evento publicado: ${pattern} - JAC ${event.id}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`Error publicando evento: ${errorMessage}`);
    }
  }

  /**
   * Notificar creación de JAC
   */
  async notifyJACCreated(jacData: { id: number; nombre: string; asocomunalId: number | null }): Promise<void> {
    await this.publishEvent({
      id: jacData.id,
      nombre: jacData.nombre,
      estado: true,
      asocomunalId: jacData.asocomunalId,
      action: 'created',
      timestamp: new Date(),
    }, 'jac.created.event');
  }

  /**
   * Notificar actualización de JAC
   */
  async notifyJACUpdated(jacData: { id: number; nombre: string; asocomunalId: number | null }): Promise<void> {
    await this.publishEvent({
      id: jacData.id,
      nombre: jacData.nombre,
      estado: true,
      asocomunalId: jacData.asocomunalId,
      action: 'updated',
      timestamp: new Date(),
    }, 'jac.updated.event');
  }

  /**
   * Notificar eliminación lógica de JAC
   */
  async notifyJACDeleted(jacId: number): Promise<void> {
    await this.publishEvent({
      id: jacId,
      nombre: '',
      estado: false,
      asocomunalId: null,
      action: 'deleted',
      timestamp: new Date(),
    }, 'jac.deleted.event');
  }
}
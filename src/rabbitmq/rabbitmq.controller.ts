/**
 * Controller para consumir eventos de Asocomunales
 * 
 * Escucha los mensajes que el microservicio de Asocomunales publica
 * y los procesa para actualizar la tabla réplica de Asocomunales
 * 
 * @decorator @EventPattern() - Define qué patrón de mensaje escuchar
 * @decorator @Payload() - Extrae los datos del mensaje
 */
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

/**
 * DTO para eventos recibidos de Asocomunales
 */
interface AsocomunalEventDto {
  id: number;
  nombre: string;
  municipioId: number;
  municipioNombre: string;
  estado: boolean;
  action: 'created' | 'updated' | 'deleted';
}

@Controller()
export class RabbitMQController {
  
  /**
   * Escuchar eventos de Asocomunales
   * 
   * Este método se ejecuta automáticamente cuando llega un mensaje
   * a la cola 'asocomunal_queue' con el patrón 'asocomunal.event'
   */
  @EventPattern('asocomunal.event')
  async handleAsocomunalEvent(@Payload() data: AsocomunalEventDto) {
    console.log('Evento recibido de Asocomunales:', data);
    
    // Aquí iría la lógica para actualizar tu tabla réplica de Asocomunales
    // Por ahora, solo logueamos para verificar que llega
    console.log(`Acción: ${data.action} - Asocomunal ${data.id} (${data.nombre})`);
    
    // TODO: Implementar actualización de tabla réplica
  }
}
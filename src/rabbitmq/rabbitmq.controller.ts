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
 * DTO para eventos de Asocomunal recibidos
 */
interface AsocomunalEventDto {
  id: number;
  nombre: string;
  municipioId: number;
  municipioNombre: string;
  estado: boolean;
  action: 'created' | 'updated' | 'deleted';
}

/**
 * DTO para eventos de JAC recibidos (confirmación)
 */
interface JACEventDto {
  id: number;
  nombre: string;
  estado: boolean;
  asocomunalId: number | null;
  action: 'created' | 'updated' | 'deleted';
}

@Controller()
export class RabbitMQController {
  
  /**
   * CONSUMER: Escuchar eventos de Asocomunales
   * Patrón: asocomunal.event (o el que use Felipe)
   * Cola: colaAsocomunales o asocomunal_queue
   */
  @EventPattern('asocomunal.event')
  async handleAsocomunalEvent(@Payload() data: AsocomunalEventDto) {
    console.log('📩 [CONSUMER] Evento recibido de Asocomunales:', data);
    
    try {
      switch (data.action) {
        case 'created':
          console.log(`✅ Crear Asocomunal en tabla réplica: ${data.nombre} (ID: ${data.id})`);
          // TODO: Implementar lógica para guardar en tabla réplica de Asocomunales
          break;
          
        case 'updated':
          console.log(`🔄 Actualizar Asocomunal en tabla réplica: ${data.nombre} (ID: ${data.id})`);
          // TODO: Implementar lógica para actualizar en tabla réplica
          break;
          
        case 'deleted':
          console.log(`🗑️ Eliminar (lógico) Asocomunal en tabla réplica: ${data.nombre} (ID: ${data.id})`);
          // TODO: Implementar eliminación lógica en tabla réplica
          break;
      }
      
      console.log('✅ Evento de Asocomunal procesado correctamente');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error procesando evento de Asocomunal:', errorMessage);
    }
  }

  /**
   * CONSUMER: Escuchar confirmaciones de JAC (opcional)
   * Patrón: jac.event
   * Cola: colaJac o jac_queue
   */
  @EventPattern('jac.event')
  async handleJACEvent(@Payload() data: JACEventDto) {
    console.log('📩 [CONSUMER] Confirmación de JAC recibida:', data);
    
    try {
      switch (data.action) {
        case 'created':
          console.log(`✅ JAC creada confirmada: ${data.nombre} (ID: ${data.id})`);
          break;
          
        case 'updated':
          console.log(`🔄 JAC actualizada confirmada: ${data.nombre} (ID: ${data.id})`);
          break;
          
        case 'deleted':
          console.log(`🗑️ JAC eliminada (lógico) confirmada: ${data.nombre} (ID: ${data.id})`);
          break;
      }
      
      console.log('✅ Evento de JAC procesado correctamente');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error procesando evento de JAC:', errorMessage);
    }
  }
}
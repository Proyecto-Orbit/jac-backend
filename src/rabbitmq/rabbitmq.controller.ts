/**
 * Controller para consumir eventos de Asocomunales
 * 
 * Escucha los mensajes que el microservicio de Asocomunales publica
 * y los procesa para actualizar la tabla réplica de Asocomunales
 * 
 * @decorator @EventPattern() - Define qué patrón de mensaje escuchar
 * @decorator @Payload() - Extrae los datos del mensaje
 */
import { Controller, Inject } from '@nestjs/common';
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
   * CONSUMER: Escuchar confirmaciones de JAC (opcional)
   * Patrón: jac.event
   * Cola: colaAsocomunales
   */
  @EventPattern('jac.event')
  async handleJACEvent(@Payload() data: JACEventDto) {
    console.log('📩 [CONSUMER] Confirmación de JAC recibida:', data);
    
    try {
      switch (data.action) {
        case 'created':
          console.log(`✅ JAC creada confirmada: ${data.nombre} (ID: ${data.id})`);
          await Promise.resolve(); // Simular procesamiento asincrono, se debe eliminar cuando se termine implementacion, se coloco por eslint rules.
          break;
          
        case 'updated':
          console.log(`🔄 JAC actualizada confirmada: ${data.nombre} (ID: ${data.id})`);
          await Promise.resolve(); // Simular procesamiento asincrono, se debe eliminar cuando se termine implementacion, se coloco por eslint rules.
          break;
          
        case 'deleted':
          console.log(`🗑️ JAC eliminada (lógico) confirmada: ${data.nombre} (ID: ${data.id})`);
          await Promise.resolve(); // Simular procesamiento asincrono, se debe eliminar cuando se termine implementacion, se coloco por eslint rules.
          break;
      }
      
      console.log('✅ Evento de JAC procesado correctamente');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error procesando evento de JAC:', errorMessage);
    }
  }
}
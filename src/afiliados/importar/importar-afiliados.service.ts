import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull } from 'typeorm';
import { Persona } from '../entities/persona.entity';
import { PersonaJAC } from '../entities/persona-jac.entity';
import { PersonaCargo } from '../entities/persona-cargo.entity';
import { Cargo } from '../entities/cargo.entity';
import { JAC } from '../../jac/entities/jac.entity';
import {
  ImportarAfiliadosResultDto,
  ImportErrorDto,
} from '../dto/importar-afiliados-result.dto';
import {
  parsearExcelAfiliados,
  ParsedAfiliado,
  ParsedDignatario,
  SHEET_AFILIADOS,
  SHEET_DIGNATARIOS,
} from './excel-parser';

/**
 * Pre-cómputo de estado de BD por cada cédula de Sheet 1.
 *
 * @remarks
 * Se construye antes de la transacción para tomar decisiones de validación
 * y luego se reutiliza dentro de la transacción: así evitamos repetir las
 * mismas consultas. Si la persona ya existe en BD y no tiene vínculo activo
 * a OTRA JAC, se actualizan sus datos; si no existe, se inserta nueva.
 */
interface EstadoCedulaBD {
  personaExistente: Persona | null;
  /** Vínculo activo (PERSONA_JAC con fecha_fin = null), si lo hay. */
  vinculoActivo: PersonaJAC | null;
}

/**
 * Servicio responsable de la importación masiva de afiliados desde un
 * archivo Excel (.xlsx) con dos sheets:
 *  - "RELACION ASOCIADOS JAC": personas a registrar como afiliados de una JAC.
 *  - "RELACION DIGNATARIOS": asignación de cargos a esas (u otras) personas.
 *
 * @remarks
 * Toda la importación corre en una única transacción. Si CUALQUIER
 * validación falla antes de la transacción, se devuelve 400 con la lista
 * completa de errores y no se persiste nada.
 */
@Injectable()
export class ImportarAfiliadosService {
  private readonly logger = new Logger(ImportarAfiliadosService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Procesa un Excel y, si todas las validaciones pasan, persiste:
   *  - Personas nuevas (sheet 1) vinculadas a la JAC indicada.
   *  - Personas ya existentes: se actualizan datos y, si no tenían vínculo
   *    activo a esta JAC, se crea PERSONA_JAC con fecha_inicio = hoy.
   *  - Cargos nuevos del tipo "Comisión de ..." cuando aparezcan en sheet 2.
   *  - Asignaciones en PERSONA_CARGO (cerrando vínculos previos del mismo cargo).
   *
   * Reglas de validación de Sheet 1 (todas pre-transacción):
   *  1. Cédula NO se repite dentro del mismo Excel.
   *  2. Si la cédula ya existe en BD pero está activa en OTRA JAC → error.
   *  3. Si la cédula ya existe en BD y NO tiene vínculo activo a otra JAC →
   *     se permite y se actualizan sus datos (no se duplica la persona).
   *
   * @throws BadRequestException - Si hay validaciones que fallan.
   * @throws NotFoundException - Si la JAC indicada no existe.
   */
  async importarExcel(
    buffer: Buffer,
    jacId: number,
  ): Promise<ImportarAfiliadosResultDto> {
    const parsed = await parsearExcelAfiliados(buffer);
    const errores: ImportErrorDto[] = [...parsed.errores];

    // 1. Validar que la JAC existe. Si no, abortamos rápido.
    const jacRepo = this.dataSource.getRepository(JAC);
    const jac = await jacRepo.findOne({ where: { id: jacId } });
    if (!jac) {
      throw new NotFoundException(`JAC con ID ${jacId} no encontrada`);
    }

    // 2. Sheet 1 — duplicados internos (sólo cédula).
    this.validarCedulasDuplicadasDentroExcel(parsed.afiliados, errores);

    // 3. Sheet 1 — estado de BD por cédula y validación de afiliación a otra JAC.
    const estadoPorCedula = await this.cargarEstadoBDSheet1(parsed.afiliados);
    this.validarAfiliacionEnOtraJAC(
      parsed.afiliados,
      jacId,
      estadoPorCedula,
      errores,
    );

    // 4. Sheet 2 — cédulas referenciadas y cargos válidos.
    const cargoRepo = this.dataSource.getRepository(Cargo);
    const cargosExistentes = await cargoRepo.find();
    const mapaCargos = new Map(
      cargosExistentes.map((c) => [c.nombre.toLowerCase(), c]),
    );

    const cedulasNuevas = new Set(parsed.afiliados.map((a) => a.cedula));
    const cedulasDignatarios = Array.from(
      new Set(parsed.dignatarios.map((d) => d.cedula)),
    );

    // Cédulas de Sheet 2 que NO están en Sheet 1: pueden estar ya en BD.
    const cedulasDignatariosFueraSheet1 = cedulasDignatarios.filter(
      (c) => !cedulasNuevas.has(c),
    );
    const cedulasYaEnBDParaSheet2 = cedulasDignatariosFueraSheet1.length
      ? new Set(
          (
            await this.dataSource.getRepository(Persona).find({
              where: { cedula: In(cedulasDignatariosFueraSheet1) },
              select: ['cedula'],
            })
          ).map((p) => p.cedula!),
        )
      : new Set<string>();

    const cargosACrear = new Set<string>();
    for (const dig of parsed.dignatarios) {
      if (
        !cedulasNuevas.has(dig.cedula) &&
        !cedulasYaEnBDParaSheet2.has(dig.cedula)
      ) {
        errores.push({
          sheet: SHEET_DIGNATARIOS,
          fila: dig.filaExcel,
          cedula: dig.cedula,
          motivo: `La cédula ${dig.cedula} no aparece en la sheet "${SHEET_AFILIADOS}" ni está registrada en la base de datos`,
        });
        continue;
      }

      if (mapaCargos.has(dig.cargoNombre.toLowerCase())) continue;

      // Cargo no existe → sólo se permite crear si empieza con "Comisión de".
      if (this.esCargoComision(dig.cargoNombre)) {
        cargosACrear.add(dig.cargoNombre);
      } else {
        errores.push({
          sheet: SHEET_DIGNATARIOS,
          fila: dig.filaExcel,
          cedula: dig.cedula,
          motivo: `El cargo "${dig.cargoNombre}" no existe y no es una comisión: no se puede crear automáticamente`,
        });
      }
    }

    if (errores.length > 0) {
      throw new BadRequestException({
        message: 'La importación contiene errores. No se modificó la base de datos.',
        errores,
      });
    }

    // 5. Todo válido → ejecutar transacción.
    return this.ejecutarTransaccion(
      jacId,
      parsed.afiliados,
      parsed.dignatarios,
      mapaCargos,
      cargosACrear,
      estadoPorCedula,
    );
  }

  /**
   * Reporta como error cualquier cédula que aparezca más de una vez
   * dentro de la sheet 1 del Excel.
   */
  private validarCedulasDuplicadasDentroExcel(
    afiliados: ParsedAfiliado[],
    errores: ImportErrorDto[],
  ): void {
    const cedulasVistas = new Map<string, number>();
    for (const a of afiliados) {
      const prev = cedulasVistas.get(a.cedula);
      if (prev !== undefined) {
        errores.push({
          sheet: SHEET_AFILIADOS,
          fila: a.filaExcel,
          cedula: a.cedula,
          motivo: `Cédula duplicada dentro del Excel (también aparece en la fila ${prev})`,
        });
      } else {
        cedulasVistas.set(a.cedula, a.filaExcel);
      }
    }
  }

  /**
   * Carga, para cada cédula de Sheet 1, la persona existente en BD (si la hay)
   * y su vínculo activo más reciente (PERSONA_JAC con fecha_fin = null).
   * El resultado lo usan tanto la fase de validación como la transacción.
   */
  private async cargarEstadoBDSheet1(
    afiliados: ParsedAfiliado[],
  ): Promise<Map<string, EstadoCedulaBD>> {
    const estado = new Map<string, EstadoCedulaBD>();
    if (afiliados.length === 0) return estado;

    const cedulas = afiliados.map((a) => a.cedula);
    const personas = await this.dataSource.getRepository(Persona).find({
      where: { cedula: In(cedulas) },
    });
    if (personas.length === 0) return estado;

    const personaIds = personas.map((p) => p.id);
    const vinculos = await this.dataSource.getRepository(PersonaJAC).find({
      where: { personaId: In(personaIds), fechaFin: IsNull() },
    });

    const vinculoPorPersona = new Map<number, PersonaJAC>();
    for (const v of vinculos) vinculoPorPersona.set(v.personaId, v);

    for (const p of personas) {
      estado.set(p.cedula!, {
        personaExistente: p,
        vinculoActivo: vinculoPorPersona.get(p.id) ?? null,
      });
    }
    return estado;
  }

  /**
   * Lanza error sólo cuando la persona ya existe en BD y tiene un vínculo
   * activo a una JAC distinta de la que se está importando. Si está sin
   * vínculo o vinculada a la misma JAC, se permite (los datos se actualizarán
   * dentro de la transacción).
   */
  private validarAfiliacionEnOtraJAC(
    afiliados: ParsedAfiliado[],
    jacIdImport: number,
    estadoPorCedula: Map<string, EstadoCedulaBD>,
    errores: ImportErrorDto[],
  ): void {
    for (const a of afiliados) {
      const estado = estadoPorCedula.get(a.cedula);
      if (!estado || !estado.vinculoActivo) continue;
      if (estado.vinculoActivo.jacId !== jacIdImport) {
        errores.push({
          sheet: SHEET_AFILIADOS,
          fila: a.filaExcel,
          cedula: a.cedula,
          motivo: `La persona con cédula ${a.cedula} ya está afiliada a otra JAC (ID ${estado.vinculoActivo.jacId})`,
        });
      }
    }
  }

  /** Determina si un cargo puede crearse automáticamente (solo comisiones). */
  private esCargoComision(nombre: string): boolean {
    const normalizado = nombre
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
    return normalizado.startsWith('comision de');
  }

  /**
   * Ejecuta toda la inserción/actualización dentro de una transacción única.
   * Si algo falla a mitad de camino, TypeORM revierte todo.
   */
  private async ejecutarTransaccion(
    jacId: number,
    afiliados: ParsedAfiliado[],
    dignatarios: ParsedDignatario[],
    mapaCargosExistentes: Map<string, Cargo>,
    cargosACrear: Set<string>,
    estadoPorCedula: Map<string, EstadoCedulaBD>,
  ): Promise<ImportarAfiliadosResultDto> {
    return this.dataSource.transaction(async (manager) => {
      const hoy = new Date();

      // a) Crear cargos nuevos (solo "Comisión de ...") si aplica.
      const cargosCreados: string[] = [];
      const mapaCargos = new Map(mapaCargosExistentes);
      for (const nombreCargo of cargosACrear) {
        const nuevo = manager.create(Cargo, { nombre: nombreCargo });
        const guardado = await manager.save(nuevo);
        mapaCargos.set(nombreCargo.toLowerCase(), guardado);
        cargosCreados.push(nombreCargo);
      }

      // b) Procesar Sheet 1: insertar nuevas o actualizar existentes.
      let afiliadosInsertados = 0;
      let afiliadosActualizados = 0;
      const personaPorCedula = new Map<string, Persona>();

      for (const a of afiliados) {
        const estado = estadoPorCedula.get(a.cedula);

        if (estado?.personaExistente) {
          // Persona ya existe: actualizar datos sin duplicar el registro.
          const persona = estado.personaExistente;
          persona.nombre = a.nombre;
          persona.apellido = a.apellido;
          persona.lugarExpedicionCedula = a.lugarExpedicionCedula;
          persona.telefono = a.telefono;
          persona.correo = a.correo;
          persona.jacId = jacId;
          const actualizada = await manager.save(persona);
          personaPorCedula.set(a.cedula, actualizada);
          afiliadosActualizados++;

          // Si no tiene vínculo activo a esta JAC, crearlo.
          const yaVinculadaAEstaJAC =
            estado.vinculoActivo?.jacId === jacId;
          if (!yaVinculadaAEstaJAC) {
            const vinculo = manager.create(PersonaJAC, {
              jacId,
              personaId: actualizada.id,
              fechaInicio: hoy,
              fechaFin: null,
            });
            await manager.save(vinculo);
          }
        } else {
          // Persona nueva: insertar y crear PERSONA_JAC.
          const persona = manager.create(Persona, {
            jacId,
            nombre: a.nombre,
            apellido: a.apellido,
            cedula: a.cedula,
            lugarExpedicionCedula: a.lugarExpedicionCedula,
            telefono: a.telefono,
            correo: a.correo,
            cargoId: null,
            municipioId: null,
          });
          const guardado = await manager.save(persona);
          personaPorCedula.set(a.cedula, guardado);
          afiliadosInsertados++;

          const vinculo = manager.create(PersonaJAC, {
            jacId,
            personaId: guardado.id,
            fechaInicio: hoy,
            fechaFin: null,
          });
          await manager.save(vinculo);
        }
      }

      // c) Asignar cargos (Sheet 2) — para personas de Sheet 1 o ya existentes.
      const cedulasFaltantes = dignatarios
        .map((d) => d.cedula)
        .filter((c) => !personaPorCedula.has(c));
      const personasYaEnBD = cedulasFaltantes.length
        ? await manager.find(Persona, {
            where: { cedula: In(cedulasFaltantes) },
          })
        : [];
      for (const p of personasYaEnBD) personaPorCedula.set(p.cedula!, p);

      let cargosAsignados = 0;
      for (const d of dignatarios) {
        const persona = personaPorCedula.get(d.cedula);
        if (!persona) {
          throw new Error(
            `Inconsistencia: persona con cédula ${d.cedula} no encontrada al asignar cargo`,
          );
        }
        const cargo = mapaCargos.get(d.cargoNombre.toLowerCase());
        if (!cargo) {
          throw new Error(
            `Inconsistencia: cargo "${d.cargoNombre}" no disponible al asignar`,
          );
        }

        // Cerrar cualquier asignación activa previa del MISMO cargo.
        await manager.update(
          PersonaCargo,
          { personaId: persona.id, cargoId: cargo.id, fechaFin: IsNull() },
          { fechaFin: hoy },
        );

        const asignacion = manager.create(PersonaCargo, {
          personaId: persona.id,
          cargoId: cargo.id,
          estadoId: 1,
          fechaInicio: hoy,
          fechaFin: null,
        });
        await manager.save(asignacion);
        cargosAsignados++;
      }

      this.logger.log(
        `Importación JAC ${jacId}: insertados=${afiliadosInsertados}, actualizados=${afiliadosActualizados}, cargos=${cargosAsignados}, cargosNuevos=${cargosCreados.length}`,
      );

      return {
        jacId,
        afiliadosInsertados,
        afiliadosActualizados,
        cargosAsignados,
        cargosCreados,
        errores: [],
      };
    });
  }
}

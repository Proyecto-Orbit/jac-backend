import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Persona } from '../entities/persona.entity';
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
 * Servicio responsable de la importación masiva de afiliados desde un
 * archivo Excel (.xlsx) con dos sheets:
 *  - "RELACION ASOCIADOS JAC": personas a registrar como afiliados de una JAC.
 *  - "RELACION DIGNATARIOS": asignación de cargos a esas (u otras) personas.
 *
 * @remarks
 * Toda la importación corre en una única transacción. Si CUALQUIER
 * validación falla antes de la transacción, se devuelve 400 con la lista
 * completa de errores y NO se persiste nada.
 *
 * Modelo de datos:
 *  - La relación Persona ↔ JAC es 1-N directa vía `persona.jacId`.
 *  - La relación Persona ↔ Cargo es 1-N directa vía `persona.cargoId`.
 *  - No existen tablas intermedias de historial.
 */
@Injectable()
export class ImportarAfiliadosService {
  private readonly logger = new Logger(ImportarAfiliadosService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Procesa un Excel y persiste el resultado en una sola transacción si
   * todas las validaciones pasan.
   *
   * Reglas de validación de Sheet 1:
   *  1. Cédula NO se repite dentro del mismo Excel.
   *  2. Si la cédula ya existe en BD y está afiliada a OTRA JAC → error.
   *  3. Si la cédula ya existe en BD sin afiliación o afiliada a la misma
   *     JAC → permitido; se actualizan los datos que el Excel traiga.
   *
   * Política de actualización: el Excel solo PISA el dato cuando trae
   * un valor no nulo. Si el Excel viene vacío para un campo, conservamos
   * lo que ya estaba en BD.
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

    // 1. Validar que la JAC existe.
    const jacRepo = this.dataSource.getRepository(JAC);
    const jac = await jacRepo.findOne({ where: { id: jacId } });
    if (!jac) {
      throw new NotFoundException(`JAC con ID ${jacId} no encontrada`);
    }

    // 2. Sheet 1 — duplicados internos de cédula.
    this.validarCedulasDuplicadasDentroExcel(parsed.afiliados, errores);

    // 3. Sheet 1 — cargar personas existentes por cédula y validar
    //    afiliación a otra JAC.
    const personasExistentesSheet1 = await this.cargarPersonasExistentes(
      parsed.afiliados.map((a) => a.cedula),
    );
    this.validarAfiliacionEnOtraJAC(
      parsed.afiliados,
      jacId,
      personasExistentesSheet1,
      errores,
    );

    // 4. Sheet 2 — validar cédulas referenciadas y cargos.
    const cargoRepo = this.dataSource.getRepository(Cargo);
    const cargosExistentes = await cargoRepo.find();
    const mapaCargos = new Map(
      cargosExistentes.map((c) => [c.nombre.toLowerCase(), c]),
    );

    const cedulasSheet1 = new Set(parsed.afiliados.map((a) => a.cedula));
    const cedulasDignatariosUnicas = Array.from(
      new Set(parsed.dignatarios.map((d) => d.cedula)),
    );
    const cedulasDignatariosFueraSheet1 = cedulasDignatariosUnicas.filter(
      (c) => !cedulasSheet1.has(c),
    );
    const personasExistentesSheet2 =
      cedulasDignatariosFueraSheet1.length
        ? await this.cargarPersonasExistentes(cedulasDignatariosFueraSheet1)
        : new Map<string, Persona>();

    // También validamos afiliación a otra JAC para personas de Sheet 2 que
    // SOLO aparecen ahí: no se les puede asignar cargo si ya están en otra JAC.
    for (const d of parsed.dignatarios) {
      const personaBD = personasExistentesSheet2.get(d.cedula);
      if (!personaBD) continue;
      if (personaBD.jacId !== null && personaBD.jacId !== jacId) {
        errores.push({
          sheet: SHEET_DIGNATARIOS,
          fila: d.filaExcel,
          cedula: d.cedula,
          motivo: `La persona con cédula ${d.cedula} ya está afiliada a otra JAC (ID ${personaBD.jacId}) — no se le puede asignar cargo en esta JAC`,
        });
      }
    }

    const cargosACrear = new Set<string>();
    for (const dig of parsed.dignatarios) {
      if (
        !cedulasSheet1.has(dig.cedula) &&
        !personasExistentesSheet2.has(dig.cedula)
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

    return this.ejecutarTransaccion(
      jacId,
      parsed.afiliados,
      parsed.dignatarios,
      mapaCargos,
      cargosACrear,
      personasExistentesSheet1,
      personasExistentesSheet2,
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
   * Carga las personas de BD cuya cédula esté en la lista dada.
   * Retorna un mapa cédula → Persona para lookups O(1).
   */
  private async cargarPersonasExistentes(
    cedulas: string[],
  ): Promise<Map<string, Persona>> {
    const mapa = new Map<string, Persona>();
    if (cedulas.length === 0) return mapa;
    const personas = await this.dataSource.getRepository(Persona).find({
      where: { cedula: In(cedulas) },
    });
    for (const p of personas) {
      if (p.cedula) mapa.set(p.cedula, p);
    }
    return mapa;
  }

  /**
   * Marca como error a las personas de Sheet 1 que ya existen en BD y
   * están afiliadas a una JAC distinta de la que se está importando.
   */
  private validarAfiliacionEnOtraJAC(
    afiliados: ParsedAfiliado[],
    jacIdImport: number,
    personasExistentes: Map<string, Persona>,
    errores: ImportErrorDto[],
  ): void {
    for (const a of afiliados) {
      const persona = personasExistentes.get(a.cedula);
      if (!persona) continue;
      if (persona.jacId !== null && persona.jacId !== jacIdImport) {
        errores.push({
          sheet: SHEET_AFILIADOS,
          fila: a.filaExcel,
          cedula: a.cedula,
          motivo: `La persona con cédula ${a.cedula} ya está afiliada a otra JAC (ID ${persona.jacId})`,
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
   * Aplica los datos del Excel sobre una entidad Persona existente,
   * sobrescribiendo SOLO los campos donde el Excel trae un valor no nulo.
   * Esta política preserva información previamente registrada que el
   * Excel no incluye.
   */
  private aplicarUpdateParcial(persona: Persona, a: ParsedAfiliado): void {
    persona.nombre = a.nombre;
    persona.apellido = a.apellido;
    if (a.lugarExpedicionCedula !== null)
      persona.lugarExpedicionCedula = a.lugarExpedicionCedula;
    if (a.fechaNacimiento !== null) persona.fechaNacimiento = a.fechaNacimiento;
    if (a.estudiosRealizados !== null)
      persona.estudiosRealizados = a.estudiosRealizados;
    if (a.ocupacion !== null) persona.ocupacion = a.ocupacion;
    if (a.genero !== null) persona.genero = a.genero;
    if (a.grupoEtnico !== null) persona.grupoEtnico = a.grupoEtnico;
    if (a.discapacitado !== null) persona.discapacitado = a.discapacitado;
    if (a.telefono !== null) persona.telefono = a.telefono;
    if (a.correo !== null) persona.correo = a.correo;
  }

  /**
   * Ejecuta toda la inserción/actualización dentro de una transacción única.
   */
  private async ejecutarTransaccion(
    jacId: number,
    afiliados: ParsedAfiliado[],
    dignatarios: ParsedDignatario[],
    mapaCargosExistentes: Map<string, Cargo>,
    cargosACrear: Set<string>,
    personasExistentesSheet1: Map<string, Persona>,
    personasExistentesSheet2: Map<string, Persona>,
  ): Promise<ImportarAfiliadosResultDto> {
    return this.dataSource.transaction(async (manager) => {
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
        const existente = personasExistentesSheet1.get(a.cedula);

        if (existente) {
          // Persona ya existe: actualizar SOLO los campos con valor en Excel.
          this.aplicarUpdateParcial(existente, a);
          existente.jacId = jacId;
          existente.activo = true;
          const actualizada = await manager.save(existente);
          personaPorCedula.set(a.cedula, actualizada);
          afiliadosActualizados++;
        } else {
          // Persona nueva.
          const persona = manager.create(Persona, {
            jacId,
            cargoId: null,
            municipioId: null,
            nombre: a.nombre,
            apellido: a.apellido,
            cedula: a.cedula,
            lugarExpedicionCedula: a.lugarExpedicionCedula,
            fechaNacimiento: a.fechaNacimiento,
            estudiosRealizados: a.estudiosRealizados,
            ocupacion: a.ocupacion,
            genero: a.genero,
            grupoEtnico: a.grupoEtnico,
            discapacitado: a.discapacitado,
            telefono: a.telefono,
            correo: a.correo,
            activo: true,
          });
          const guardado = await manager.save(persona);
          personaPorCedula.set(a.cedula, guardado);
          afiliadosInsertados++;
        }
      }

      // c) Sumar al mapa las personas que vienen SOLO en Sheet 2 (ya en BD).
      for (const [cedula, persona] of personasExistentesSheet2) {
        if (!personaPorCedula.has(cedula)) {
          personaPorCedula.set(cedula, persona);
        }
      }

      // d) Asignar cargos (Sheet 2): se sobrescribe persona.cargoId.
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

        persona.cargoId = cargo.id;
        // Si la persona no estaba afiliada a esta JAC todavía (caso Sheet 2
        // sin pasar por Sheet 1), aprovechamos para afiliarla aquí.
        if (persona.jacId === null) persona.jacId = jacId;
        await manager.save(persona);
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

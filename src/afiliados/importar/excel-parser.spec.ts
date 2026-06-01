import {
  parsearNombre,
  extraerFechaNacimiento,
  validarCedulaFormato,
  validarTelefonoFormato,
  nombreComision,
} from './excel-parser';

/**
 * Pruebas unitarias de las funciones puras del parser de Excel.
 *
 * @remarks
 * Se eligieron las funciones puras (sin dependencia de ExcelJS.Row ni I/O)
 * porque concentran las reglas de negocio del parseo y son deterministas:
 *  - parsearNombre / extraerFechaNacimiento → CAJA BLANCA: tienen muchas
 *    ramas internas; se diseña un caso por cada camino (cobertura de
 *    decisiones), aprovechando el conocimiento del código.
 *  - validarCedulaFormato / validarTelefonoFormato / nombreComision →
 *    CAJA NEGRA: su contrato entrada→salida es simple y estable; se aplican
 *    clases de equivalencia y valores límite sin mirar la implementación.
 */
describe('excel-parser (funciones puras)', () => {
  // ════════════════════════════════════════════════════════════════════
  //  ENFOQUE CAJA BLANCA
  //  Se conocen las ramas internas y se cubre cada camino de decisión.
  // ════════════════════════════════════════════════════════════════════
  describe('enfoque caja blanca', () => {
    /**
     * parsearNombre tiene 5 caminos según el número de palabras:
     * 0, 1, 2, 3 y 4+. Se cubre cada uno (cobertura de decisiones), más
     * el camino de normalización de espacios múltiples.
     */
    describe('parsearNombre', () => {
      it('camino 0 palabras (cadena vacía) → nombre y apellido vacíos', () => {
        expect(parsearNombre('')).toEqual({ nombre: '', apellido: '' });
      });

      it('camino 0 palabras (solo espacios) → nombre y apellido vacíos', () => {
        expect(parsearNombre('   ')).toEqual({ nombre: '', apellido: '' });
      });

      it('camino 1 palabra → todo va a nombre, apellido vacío', () => {
        expect(parsearNombre('Juan')).toEqual({ nombre: 'Juan', apellido: '' });
      });

      it('camino 2 palabras → primer nombre, primer apellido', () => {
        expect(parsearNombre('Juan Pérez')).toEqual({
          nombre: 'Juan',
          apellido: 'Pérez',
        });
      });

      it('camino 3 palabras → primer nombre, dos apellidos', () => {
        expect(parsearNombre('Juan Pérez Gómez')).toEqual({
          nombre: 'Juan',
          apellido: 'Pérez Gómez',
        });
      });

      it('camino 4+ palabras → dos nombres, el resto apellido', () => {
        expect(parsearNombre('Juan Carlos Pérez Gómez')).toEqual({
          nombre: 'Juan Carlos',
          apellido: 'Pérez Gómez',
        });
      });

      it('camino 5 palabras → dos nombres, tres apellidos', () => {
        expect(parsearNombre('Ana María Del Río Soto')).toEqual({
          nombre: 'Ana María',
          apellido: 'Del Río Soto',
        });
      });

      it('rama de normalización: colapsa espacios múltiples', () => {
        expect(parsearNombre('  Juan    Pérez  ')).toEqual({
          nombre: 'Juan',
          apellido: 'Pérez',
        });
      });
    });

    /**
     * extraerFechaNacimiento tiene 7 ramas:
     *  1) null/undefined → válido, fecha null
     *  2) Date válido → válido con esa fecha
     *  3) Date inválido (NaN) → inválido
     *  4) number → inválido (formato)
     *  5) string vacío → válido, fecha null
     *  6) string sin formato DD/MM/YYYY → inválido
     *  7) string con formato pero fecha irreal → inválido
     *  8) string DD/MM/YYYY válido → válido con la fecha parseada
     */
    describe('extraerFechaNacimiento', () => {
      it('rama null → válido con fecha null', () => {
        expect(extraerFechaNacimiento(null)).toEqual({
          valido: true,
          fecha: null,
        });
      });

      it('rama undefined → válido con fecha null', () => {
        expect(extraerFechaNacimiento(undefined)).toEqual({
          valido: true,
          fecha: null,
        });
      });

      it('rama Date válido → válido conservando la fecha', () => {
        const d = new Date(1990, 4, 15);
        const res = extraerFechaNacimiento(d);
        expect(res.valido).toBe(true);
        expect(res.fecha).toBe(d);
      });

      it('rama Date inválido (NaN) → inválido', () => {
        const res = extraerFechaNacimiento(new Date('fecha-basura'));
        expect(res.valido).toBe(false);
        expect(res.fecha).toBeNull();
        expect(res.motivo).toContain('inválida');
      });

      it('rama number → inválido por formato', () => {
        const res = extraerFechaNacimiento(44000);
        expect(res.valido).toBe(false);
        expect(res.motivo).toContain('DD/MM/YYYY');
      });

      it('rama string vacío → válido con fecha null', () => {
        expect(extraerFechaNacimiento('   ')).toEqual({
          valido: true,
          fecha: null,
        });
      });

      it('rama string sin formato → inválido', () => {
        const res = extraerFechaNacimiento('15-05-1990');
        expect(res.valido).toBe(false);
        expect(res.motivo).toContain('no tiene el formato DD/MM/YYYY');
      });

      it('rama string con formato pero fecha irreal (31/02/2000) → inválido', () => {
        const res = extraerFechaNacimiento('31/02/2000');
        expect(res.valido).toBe(false);
        expect(res.motivo).toContain('no representa una fecha real');
      });

      it('rama string DD/MM/YYYY válido → válido con la fecha correcta', () => {
        const res = extraerFechaNacimiento('15/05/1990');
        expect(res.valido).toBe(true);
        expect(res.fecha).not.toBeNull();
        expect(res.fecha!.getFullYear()).toBe(1990);
        expect(res.fecha!.getMonth()).toBe(4); // mayo (0-based)
        expect(res.fecha!.getDate()).toBe(15);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════
  //  ENFOQUE CAJA NEGRA
  //  Solo se considera el contrato entrada→salida (clases de equivalencia
  //  y valores límite), sin conocer la implementación interna.
  // ════════════════════════════════════════════════════════════════════
  describe('enfoque caja negra', () => {
    /**
     * validarCedulaFormato:
     *  Clase válida   → string compuesto SOLO por dígitos.
     *  Clase inválida → contiene letras, símbolos, espacios o está vacío.
     */
    describe('validarCedulaFormato', () => {
      it('CE válida: solo dígitos', () => {
        expect(validarCedulaFormato('1061750123')).toEqual({ valido: true });
      });

      it('VL válida: un solo dígito', () => {
        expect(validarCedulaFormato('1')).toEqual({ valido: true });
      });

      it('CE inválida: contiene letras', () => {
        const res = validarCedulaFormato('10617A0123');
        expect(res.valido).toBe(false);
        expect(res.motivo).toContain('caracteres no numéricos');
      });

      it('CE inválida: contiene guiones', () => {
        expect(validarCedulaFormato('10-61-75').valido).toBe(false);
      });

      it('CE inválida: contiene espacios', () => {
        expect(validarCedulaFormato('1061 7501').valido).toBe(false);
      });

      it('VL inválida: cadena vacía', () => {
        expect(validarCedulaFormato('').valido).toBe(false);
      });
    });

    /**
     * validarTelefonoFormato:
     *  Clase válida   → sin letras (dígitos, espacios, + - ( ) permitidos).
     *  Clase inválida → contiene al menos una letra.
     */
    describe('validarTelefonoFormato', () => {
      it('CE válida: solo dígitos', () => {
        expect(validarTelefonoFormato('3001234567')).toEqual({ valido: true });
      });

      it('CE válida: con separadores + - ( )', () => {
        expect(validarTelefonoFormato('+57 (300) 123-4567')).toEqual({
          valido: true,
        });
      });

      it('CE inválida: contiene letras', () => {
        const res = validarTelefonoFormato('300ABC4567');
        expect(res.valido).toBe(false);
        expect(res.motivo).toContain('contiene letras');
      });

      it('VL inválida: una sola letra entre dígitos', () => {
        expect(validarTelefonoFormato('300123456x').valido).toBe(false);
      });
    });

    /**
     * nombreComision: transforma el texto tras "DE:" en el cargo canónico.
     *  Clase válida típica → capitaliza cada palabra y antepone "Comisión de".
     *  Valores límite → cadena vacía / solo espacios → cadena vacía.
     */
    describe('nombreComision', () => {
      it('CE típica: una palabra', () => {
        expect(nombreComision('deportes')).toBe('Comisión de Deportes');
      });

      it('CE típica: varias palabras se capitalizan todas', () => {
        expect(nombreComision('deportes y juventud')).toBe(
          'Comisión de Deportes Y Juventud',
        );
      });

      it('CE: respeta y colapsa espacios alrededor', () => {
        expect(nombreComision('  salud  comunitaria  ')).toBe(
          'Comisión de Salud Comunitaria',
        );
      });

      it('VL: cadena vacía → cadena vacía', () => {
        expect(nombreComision('')).toBe('');
      });

      it('VL: solo espacios → cadena vacía', () => {
        expect(nombreComision('    ')).toBe('');
      });
    });
  });
});

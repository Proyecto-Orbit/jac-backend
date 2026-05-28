/**
 * Lista de ciudades / municipios de Colombia válidos como lugar de
 * expedición de la cédula.
 *
 * @remarks
 * Los nombres están en MAYÚSCULAS y SIN TILDES para comparar contra
 * el valor del Excel previamente normalizado. La lista cubre las 32
 * capitales departamentales, los 42 municipios del Cauca (contexto
 * del proyecto) y ~100 ciudades adicionales relevantes. No es
 * exhaustiva — si aparece un municipio válido que no está aquí,
 * agrégalo a este arreglo y vuelve a compilar.
 */
export const CIUDADES_COLOMBIA: readonly string[] = [
  // ── Capitales de departamento ──────────────────────────────────────────
  'BOGOTA',
  'BOGOTA D.C.',
  'BOGOTA DC',
  'MEDELLIN',
  'CALI',
  'BARRANQUILLA',
  'CARTAGENA',
  'CARTAGENA DE INDIAS',
  'CUCUTA',
  'BUCARAMANGA',
  'PEREIRA',
  'SANTA MARTA',
  'IBAGUE',
  'PASTO',
  'MANIZALES',
  'NEIVA',
  'VILLAVICENCIO',
  'VALLEDUPAR',
  'ARMENIA',
  'MONTERIA',
  'SINCELEJO',
  'POPAYAN',
  'TUNJA',
  'FLORENCIA',
  'RIOHACHA',
  'YOPAL',
  'MOCOA',
  'SAN ANDRES',
  'QUIBDO',
  'ARAUCA',
  'SAN JOSE DEL GUAVIARE',
  'MITU',
  'INIRIDA',
  'LETICIA',
  'PUERTO CARRENO',

  // ── Municipios del Cauca ───────────────────────────────────────────────
  'ALMAGUER',
  'ARGELIA',
  'BALBOA',
  'BOLIVAR',
  'BUENOS AIRES',
  'CAJIBIO',
  'CALDONO',
  'CALOTO',
  'CORINTO',
  'EL TAMBO',
  'GUACHENE',
  'GUAPI',
  'INZA',
  'JAMBALO',
  'LA SIERRA',
  'LA VEGA',
  'LOPEZ DE MICAY',
  'MERCADERES',
  'MIRANDA',
  'MORALES',
  'PADILLA',
  'PAEZ',
  'PATIA',
  'PIAMONTE',
  'PIENDAMO',
  'PUERTO TEJADA',
  'PURACE',
  'ROSAS',
  'SAN SEBASTIAN',
  'SANTA ROSA',
  'SANTANDER DE QUILICHAO',
  'SILVIA',
  'SOTARA',
  'SUAREZ',
  'SUCRE',
  'TIMBIO',
  'TIMBIQUI',
  'TORIBIO',
  'TOTORO',
  'VILLA RICA',

  // ── Otras ciudades importantes ─────────────────────────────────────────
  'SOLEDAD',
  'SOACHA',
  'BELLO',
  'ITAGUI',
  'ENVIGADO',
  'PALMIRA',
  'BUENAVENTURA',
  'TULUA',
  'CARTAGO',
  'JAMUNDI',
  'YUMBO',
  'GIRARDOT',
  'CIENAGA',
  'FUSAGASUGA',
  'FACATATIVA',
  'ZIPAQUIRA',
  'CHIA',
  'MOSQUERA',
  'MADRID',
  'FUNZA',
  'CAJICA',
  'PIEDECUESTA',
  'FLORIDABLANCA',
  'GIRON',
  'BARRANCABERMEJA',
  'DUITAMA',
  'SOGAMOSO',
  'CHIQUINQUIRA',
  'OCANA',
  'PAMPLONA',
  'MAGANGUE',
  'TURBO',
  'APARTADO',
  'RIONEGRO',
  'CALARCA',
  'DOSQUEBRADAS',
  'LA DORADA',
  'CHINCHINA',
  'LA VIRGINIA',
  'PITALITO',
  'GARZON',
  'LA PLATA',
  'ESPINAL',
  'HONDA',
  'MELGAR',
  'TUMACO',
  'IPIALES',
  'TUQUERRES',
  'MALAMBO',
  'PUERTO COLOMBIA',
  'SABANALARGA',
  'EL CARMEN DE BOLIVAR',
  'AGUACHICA',
  'CORDOBA',
  'CERETE',
  'LORICA',
  'COROZAL',
  'SAN MARCOS',
  'MAICAO',
  'URIBIA',
  'MANAURE',
  'FONSECA',
  'SAN VICENTE DEL CAGUAN',
  'SAN ANDRES DE TUMACO',
  'PUERTO ASIS',
  'PUERTO BOYACA',
  'PUERTO BERRIO',
  'PUERTO LOPEZ',
  'PUERTO GAITAN',
  'ACACIAS',
  'GRANADA',
  'SAN GIL',
  'MALAGA',
  'MOCOA',
  'SAHAGUN',
  'PLANETA RICA',
];

/**
 * Set normalizado (UPPER, sin tildes) para lookups O(1).
 * Internamente se llena desde {@link CIUDADES_COLOMBIA}.
 */
export const CIUDADES_COLOMBIA_SET: ReadonlySet<string> = new Set(
  CIUDADES_COLOMBIA.map((c) =>
    c
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase(),
  ),
);

/**
 * Verifica si un texto corresponde a una ciudad colombiana válida.
 * Normaliza el input (UPPER + sin tildes + espacios colapsados) antes de comparar.
 */
export function esCiudadColombianaValida(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const normalizado = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return CIUDADES_COLOMBIA_SET.has(normalizado);
}

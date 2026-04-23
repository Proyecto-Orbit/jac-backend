# Esquema de Base de Datos

> Última actualización: 2026-04-23
> Motor: **PostgreSQL**

---

## Tablas del dominio JAC

### JAC
Representa una Junta de Acción Comunal.
La eliminación es **lógica**: se cambia `estado` a `inactiva` en lugar de borrar el registro.

| Columna         | Tipo                              | Nulo | Descripción                                            |
|-----------------|-----------------------------------|------|--------------------------------------------------------|
| id              | INT                               | NO   | PK auto-incremental                                    |
| asocomunal_id   | INT                               | SÍ   | FK → ASOCOMUNAL.id (opcional)                          |
| estado          | ENUM('activa','inactiva','cancelada') | NO | Estado actual. Default: `activa`                   |
| nombre_corto    | VARCHAR(100)                      | SÍ   | Nombre abreviado o coloquial                           |
| nombre_completo | VARCHAR(100)                      | NO   | Nombre completo oficial                                |
| numero_RUC      | VARCHAR(20)   | SÍ   | Número de RUC (no todas las JAC lo tienen)         |

---

### ASOCOMUNAL
Réplica local de las Asocomunales. Se gestiona **exclusivamente** mediante
eventos RabbitMQ publicados por el microservicio de Asocomunales.
No existe endpoint HTTP de escritura para esta tabla.

| Columna          | Tipo          | Nulo | Descripción                                        |
|------------------|---------------|------|----------------------------------------------------|
| id               | INT           | NO   | PK proveniente del microservicio origen (no auto)  |
| nombre           | VARCHAR(150)  | NO   | Nombre oficial de la Asocomunal                    |
| municipio_id     | INT           | SÍ   | ID del municipio (referencia externa)              |
| municipio_nombre | VARCHAR(100)  | SÍ   | Nombre del municipio (desnormalizado)              |
| estado           | BOOLEAN       | NO   | Estado activo/inactivo según el sistema origen     |

---

## Tablas del dominio Afiliados

### PERSONA
Representa un afiliado o integrante de una JAC.

| Columna                  | Tipo         | Nulo | Descripción                             |
|--------------------------|--------------|------|-----------------------------------------|
| id                       | INT          | NO   | PK auto-incremental                     |
| cargo_id                 | INT          | SÍ   | FK → CARGO.id (cargo actual)            |
| municipio_id             | INT          | SÍ   | ID del municipio (referencia externa)   |
| JAC_id                   | INT          | SÍ   | FK → JAC.id (JAC a la que pertenece)   |
| nombre                   | VARCHAR(100) | NO   | Nombre de pila                          |
| apellido                 | VARCHAR(100) | NO   | Apellido(s)                             |
| cedula                   | VARCHAR(20)  | SÍ   | Número de cédula                        |
| lugar_expedicion_cedula  | VARCHAR(50)  | SÍ   | Lugar de expedición del documento       |
| telefono                 | VARCHAR(20)  | SÍ   | Número telefónico de contacto           |
| correo                   | VARCHAR(20)  | SÍ   | Correo electrónico de contacto          |

---

### CARGO
Catálogo de cargos disponibles dentro de una JAC.

| Columna | Tipo         | Nulo | Descripción             |
|---------|--------------|------|-------------------------|
| id      | INT          | NO   | PK auto-incremental     |
| nombre  | VARCHAR(100) | NO   | Nombre del cargo        |

---

### PERSONA_CARGO
Historial de cargos desempeñados por una persona.
Permite registrar múltiples cargos a lo largo del tiempo.

| Columna     | Tipo | Nulo | Descripción                                          |
|-------------|------|------|------------------------------------------------------|
| id          | INT  | NO   | PK auto-incremental                                  |
| estado_id   | INT  | SÍ   | Estado de la asignación (referencia externa)         |
| persona_id  | INT  | NO   | FK → PERSONA.id                                      |
| cargo_id    | INT  | NO   | FK → CARGO.id                                        |
| fecha_inicio| DATE | SÍ   | Fecha de inicio del cargo                            |
| fecha_fin   | DATE | SÍ   | Fecha de fin del cargo (`null` = actualmente activo) |

---

### PERSONA_JAC
Historial de vinculación de personas a JACs.

| Columna     | Tipo | Nulo | Descripción                                          |
|-------------|------|------|------------------------------------------------------|
| id          | INT  | NO   | PK auto-incremental                                  |
| jac_id      | INT  | NO   | FK → JAC.id                                          |
| persona_id  | INT  | NO   | FK → PERSONA.id                                      |
| fecha_inicio| DATE | SÍ   | Fecha de inicio de la vinculación                    |
| fecha_fin   | DATE | SÍ   | Fecha de fin (`null` = vínculo actualmente activo)   |

---

## Relaciones entre tablas

```
ASOCOMUNAL (réplica RabbitMQ)
    │
    │ 0..1 ──────── * JAC
    │
    JAC
    │
    │ 1 ──────── * PERSONA_JAC ──────── * PERSONA
    │                                        │
    │                                        │ 1 ──────── * PERSONA_CARGO ──────── * CARGO
    │                                        │
    │                                        └──── cargo_id (cargo actual, FK → CARGO)
    │
    └── estado_id (referencia externa a tabla de estados no mapeada)
```

## Convenciones

| Convención     | Valor        |
|----------------|--------------|
| JAC activa     | `estado = 'activa'` |
| JAC inactiva   | `estado = 'inactiva'` |
| JAC cancelada  | `estado = 'cancelada'` |
| Asocomunal activa | `estado = true` |
| Eliminación JAC | Lógica (`estado → 'inactiva'`) |
| Eliminación PERSONA | Física (DELETE) |

# CLAUDE.md — JAC Backend

Documento de contexto persistente del proyecto. Mantener actualizado al introducir cambios estructurales para evitar re-escaneos en cada sesión.

> Última actualización: 2026-05-06

---

## 1. Resumen del proyecto

**JAC Backend** es un microservicio NestJS responsable de la gestión de **Juntas de Acción Comunal (JAC)** y sus afiliados en el departamento del Cauca. Forma parte de una arquitectura distribuida de 6 microservicios.

- **Framework:** NestJS 11 (TypeScript, Node)
- **BD:** PostgreSQL (vía TypeORM 0.3, `synchronize: true` solo en `NODE_ENV=development`)
- **Mensajería:** RabbitMQ (`@nestjs/microservices`, transport RMQ)
- **Auth:** JWT en cookie HTTP-only (`@nestjs/jwt`), validado por `RolesGuard` global
- **Puerto por defecto:** `3001` (`PORT` env, el `.env.example` sugiere 3002)

Idioma: el código y comentarios están en **español**. Mantener consistencia al escribir código nuevo y respuestas al usuario.

---

## 2. Estructura del repositorio

```
jac-backend/
├── src/
│   ├── main.ts                    # bootstrap: HTTP + microservicio RMQ + cookieParser + CORS
│   ├── app.module.ts              # Config + TypeORM + JWT global + módulos + RolesGuard global
│   │
│   ├── jac/                       # Dominio JAC (CRUD + búsqueda)
│   │   ├── jac.controller.ts      # REST /jac, /jac/buscar, /jac/:id
│   │   ├── jac.service.ts         # Lógica + notifica RabbitMQ
│   │   ├── jac.module.ts
│   │   ├── dto/                   # create, update, search, response, item
│   │   ├── entities/jac.entity.ts # Tabla "JAC" con enum EstadoJAC
│   │   └── infrastructure/messaging/jac.consumer.ts
│   │
│   ├── afiliados/                 # Dominio Personas (afiliados a JAC)
│   │   ├── afiliados.controller.ts # REST /afiliados, /afiliados/:id/cargo, /cargos
│   │   ├── afiliados.service.ts
│   │   ├── afiliados.module.ts
│   │   ├── dto/                    # create-persona, update-persona, assign-cargo, persona-response
│   │   └── entities/               # persona, cargo, persona-cargo (historial), persona-jac (historial)
│   │
│   ├── asocomunal/                # Réplica local de Asocomunales (solo escritura vía RMQ)
│   │   ├── asocomunal.service.ts  # upsert / remove
│   │   ├── asocomunal.module.ts
│   │   └── entities/asocomunal.entity.ts
│   │
│   ├── auth/                      # Guard de autenticación basado en JWT cookie
│   │   ├── auth.decorator.ts      # @Auth(Role.ADMIN)
│   │   ├── role.enum.ts
│   │   └── roles.guard.ts         # Registrado como APP_GUARD global
│   │
│   └── rabbitmq/
│       ├── rabbitmq.controller.ts # @EventPattern('asocomunal.event'), 'jac.event'
│       ├── rabbitmq.service.ts    # Publica eventos jac.events
│       └── rabbitmq.module.ts
│
├── migracion/                     # Scripts de migración desde Excel
│   ├── migracion.py               # Script principal (Python)
│   ├── migracion_requirements.txt
│   ├── seed-cargo.sql             # Datos base
│   └── post-migracion.sql         # Limpieza posterior
│
├── statics/                       # Carpeta para datos.xlsx (NO en git)
├── docs/arquitectura.png
├── database-schema.md             # Esquema canónico de la BD
├── jac-endpoints.txt              # Especificación de endpoints JAC
├── README.md                      # Setup y comandos
├── .env / .env.example
└── package.json
```

---

## 3. Modelo de datos (PostgreSQL)

Esquema canónico en `database-schema.md`. Resumen:

| Tabla            | Descripción                                                  | Notas relevantes                                  |
|------------------|--------------------------------------------------------------|---------------------------------------------------|
| `JAC`            | Junta de Acción Comunal                                      | `estado` enum: `activa` / `inactiva` / `cancelada`. `tipo` enum: `barrio` / `vereda` (Ley 2166/2021). **Eliminación lógica.** |
| `ASOCOMUNAL`     | Réplica local de Asocomunales                                | Solo se modifica vía eventos RMQ (`asocomunal.event`). PK no auto. |
| `PERSONA`        | Afiliado a una JAC                                           | FK → `JAC`, `CARGO`, `municipio_id` externo. Eliminación física. |
| `CARGO`          | Catálogo de cargos                                           | —                                                 |
| `PERSONA_CARGO`  | Historial de cargos por persona                              | `fecha_fin = null` ⇒ activo.                      |
| `PERSONA_JAC`    | Historial de vinculación persona ↔ JAC                       | `fecha_fin = null` ⇒ vínculo activo.              |

Convenciones clave:
- `JAC.estado = 'activa'` para JACs vigentes; `delete` cambia a `'inactiva'`.
- `JAC.tipo` controla el umbral legal de afiliados activos para subsistir (Ley 2166/2021 Art. 11): `barrio` ≥ 38, `vereda` ≥ 10. El cómputo de `enRiesgo` se hace en `JacItemDto.fromEntity`.
- `Asocomunal.estado` es `boolean` (no enum como JAC).
- Las JACs sin asocomunal NO aparecen al filtrar por `municipio` en `/jac/buscar`.

---

## 4. Endpoints HTTP

Todos requieren cookie con JWT firmado por `JWT_SECRET` y rol `admin` (decorator `@Auth(Role.ADMIN)`).

### `JacController` (`/jac`)
- `POST /jac` — crear JAC; emite `jac.events` con `action='created'`.
- `GET /jac?limite=N` — lista JACs activas (default `limite=100`); incluye `asocomunal`, `personas`, `personas.cargo`.
- `GET /jac/buscar?nombre=&municipio=&estado=&limite=` — búsqueda con QueryBuilder (LIKE case-insensitive). `estado` opcional retorna todos.
- `GET /jac/:id` — busca con `relations: ['asocomunal', 'personas', 'personas.cargo']`. **Nota:** actualmente NO filtra por estado (devuelve también inactivas / canceladas), pese a que el comentario en el servicio dice lo contrario.
- `PATCH /jac/:id` — actualiza; emite `jac.events` con `action='updated'`.
- `DELETE /jac/:id` — eliminación lógica (`estado → INACTIVA`); emite `jac.events` con `action='deleted'`.

### `AfiliadosController` (`/afiliados`)
- `POST /afiliados` — crear persona.
- `GET /afiliados` — listar.
- `GET /afiliados/:id` — obtener.
- `PATCH /afiliados/:id` — actualizar.
- `DELETE /afiliados/:id` — eliminar (físico).
- `POST /afiliados/:id/cargo` — asignar cargo (crea registro en `PERSONA_CARGO`).
- `GET /afiliados/:id/cargos` — historial de cargos.

Errores estándar: `400` (validación DTO), `401` (sin cookie), `403` (rol no autorizado), `404` (no encontrado).

Spec más detallada en `jac-endpoints.txt`.

---

## 5. Mensajería RabbitMQ

### Consumo (entrada)
`main.ts` conecta un microservicio RMQ a la cola `colaAsocomunales` (URL `RABBITMQ_URL` o `amqp://localhost:5672`).

`RabbitMQController` (registrado en `JacModule`) escucha:
- `asocomunal.event` → `AsocomunalService.upsert/remove` (sincroniza la réplica local).
- `jac.event` → solo logging (confirmación).

### Publicación (salida)
`RabbitMQService` usa el cliente `JAC_PROVIDER_SERVICE` (`ClientRMQ`) y emite con `pattern = 'jac.events'`:

```ts
{ id, nombre, estado: boolean, asocomunalId, action: 'created'|'updated'|'deleted', timestamp }
```

Pub fire-and-forget; errores se loguean pero no se relanzan.

> Discrepancia conocida: el productor emite `jac.events` (con S) mientras el consumidor escucha `jac.event` (sin S). Confirmar con el equipo de Asocomunales antes de modificar.

---

## 6. Autenticación

- Cookie nombrada por `COOKIE_NAME` (debe coincidir con el microservicio de auth).
- `RolesGuard` (global vía `APP_GUARD`) verifica firma con `JWT_SECRET` y compara `payload.rol` contra los roles del decorator `@Auth(...)`.
- Si no hay `@Auth`, la ruta es pública.
- Tras validar, adjunta `payload` a `request.user`.

`Role.ADMIN` es el único rol usado actualmente.

---

## 7. Variables de entorno (.env)

| Variable                    | Uso                                              |
|-----------------------------|--------------------------------------------------|
| `NODE_ENV`                  | `development` activa `synchronize` de TypeORM   |
| `PORT`                      | Puerto HTTP (3001 por defecto en código)        |
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | PostgreSQL                       |
| `RABBITMQ_URI`              | URI broker (usado en `RabbitMQModule`)          |
| `RABBITMQ_URL`              | Usado en `main.ts` para el microservicio consumidor (¡distinto de URI!) |
| `RABBITMQ_JAC_QUEUE`        | Cola donde JAC publica                          |
| `RABBITMQ_ASCOMUNAL_QUEUE`  | Cola donde JAC escucha (default `colaAsocomunales`) |
| `JWT_SECRET`                | Secreto de firma JWT                            |
| `CORS_ORIGIN`               | Origen permitido (default `http://localhost:3000`) |
| `COOKIE_NAME`               | Nombre de la cookie con el JWT                  |

> Hay dos nombres distintos para la URL de RabbitMQ (`RABBITMQ_URI` y `RABBITMQ_URL`). Verificar antes de tocar configuración.

---

## 8. Comandos

```bash
npm install                # dependencias
npm run start:dev          # watch mode (synchronize ON con NODE_ENV=development)
npm run start              # arranque normal
npm run start:prod         # usa dist/
npm run build              # nest build
npm run lint               # eslint --fix
npm run format             # prettier
npm run test               # jest unit
npm run test:e2e           # jest e2e (test/jest-e2e.json)
npm run test:cov           # cobertura
```

Migración (Python, env virtual `migracion_env`):
```
pip install -r migracion/migracion_requirements.txt
# 1) seed-cargo.sql en BD vacía
# 2) python migracion/migracion.py (requiere statics/datos.xlsx)
# 3) post-migracion.sql
```

---

## 9. Convenciones del proyecto

- **Idioma:** comentarios, nombres de DTO y mensajes en español.
- **Comentarios:** se usan JSDoc descriptivos en controladores/servicios/entidades.
- **Naming:** entidades en SCREAMING_CASE para tablas (`@Entity('JAC')`, `@Entity('PERSONA')`); columnas snake_case en BD pero camelCase en TS (vía `name:` en `@Column`).
- **DTOs de respuesta:** patrón `XResponseDto.fromEntity(entity)` / `fromEntities(arr)`.
- **Errores:** lanzar `NotFoundException`, `UnauthorizedException`, `ForbiddenException` de NestJS.
- **`synchronize: true`** SOLO en development. En producción usar migraciones.
- **No mockear la BD** en tests de integración (preferir BD real / contenedor).

---

## 10. Estado actual y áreas en progreso

Cambios sin commitear al momento de redactar este doc:
- `src/jac/dto/search-jac.dto.ts`
- `src/jac/jac.controller.ts`
- `src/jac/jac.service.ts`

Commits recientes indican trabajo activo en:
- Migración desde Excel (límites de tamaño en RUC, correos, nombres).
- Cálculo del "estado documental" basado en `numero_RUC`.
- Limitación de resultados en `findAll` (default 100).
- Soporte para JACs canceladas.

Pendientes conocidos / discrepancias a verificar antes de cambiar:
- `jac.event` vs `jac.events` (consumidor vs productor).
- `RABBITMQ_URI` vs `RABBITMQ_URL`.
- `findOne` retorna JACs en cualquier estado pese al docstring que dice "activa".

---

## 11. Cómo actualizar este documento

Editar al introducir:
- Nuevas tablas / cambios de esquema → seccs. 3 y referencia a `database-schema.md`.
- Nuevos endpoints o cambios de rutas → secc. 4.
- Nuevos patrones RMQ / colas → secc. 5.
- Nuevos roles / cambios en auth → secc. 6.
- Nuevas variables de entorno → secc. 7.
- Decisiones arquitectónicas o convenciones → secc. 9.

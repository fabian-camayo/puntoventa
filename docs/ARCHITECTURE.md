# Arquitectura del Sistema PuntoVenta

## 1. Visión General

PuntoVenta es un sistema POS empresarial con arquitectura **Cliente-Servidor** desacoplada, preparado para evolucionar durante años sin reescrituras mayores.

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON (Desktop Shell)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Main Process │  │   Preload    │  │  Renderer (Ionic) │ │
│  │  - Backend    │  │  - IPC Bridge│  │  - Angular UI     │ │
│  │  - Config     │  │  - Security  │  │  - POS / Admin    │ │
│  │  - Discovery  │  │              │  │  - i18n / Theme   │ │
│  └──────┬───────┘  └──────────────┘  └────────┬─────────┘ │
│         │ spawn                                  │ HTTP      │
│  ┌──────▼──────────────────────────────────────▼─────────┐  │
│  │              NestJS API (REST + JWT)                   │  │
│  │  ┌─────────┐ ┌────────────┐ ┌─────────────────────┐  │  │
│  │  │Presentation│ Application │ Infrastructure       │  │  │
│  │  │Controllers │ Services    │ Repositories/Prisma  │  │  │
│  │  │Guards      │ DTOs        │ Migration Runner     │  │  │
│  │  └─────────┘ └────────────┘ └──────────┬──────────┘  │  │
│  └─────────────────────────────────────────┼─────────────┘  │
└────────────────────────────────────────────┼───────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │    MySQL 8      │
                                    │  Prisma Migrate │
                                    └─────────────────┘
```

## 2. Clean Architecture por Módulo

Cada módulo NestJS sigue la misma estructura:

```
modules/{nombre}/
├── {nombre}.module.ts
├── domain/                    # (futuro) Entidades de dominio puras
├── application/
│   ├── {nombre}.service.ts  # Casos de uso / lógica de negocio
│   └── dto/                   # Data Transfer Objects con validación
├── infrastructure/
│   └── {entity}.repository.ts  # Acceso a datos vía Prisma
└── presentation/
    └── {nombre}.controller.ts    # Endpoints HTTP
```

### Principios aplicados

- **SRP**: Cada servicio tiene una responsabilidad clara
- **DIP**: Servicios dependen de repositorios, no de Prisma directamente
- **OCP**: Nuevos módulos se agregan sin modificar existentes
- **Permisos dinámicos**: Nunca codificados; siempre desde BD

## 3. Base de Datos

### Diseño normalizado (3FN)

- **Multi-empresa preparado**: `companies` → `branches`
- **RBAC completo**: `users` → `user_roles` → `roles` → `role_permissions` → `permissions`
- **Ventas concurrentes**: Campo `version` en `sales` e `inventory_items` (optimistic locking)
- **Pestañas de venta**: Campo `tab_id` + `tab_order` en `sales`
- **Auditoría**: Tabla `audit_logs` con JSON para valores anteriores/nuevos

### Sistema de Migraciones

Equivalente a Liquibase con Prisma Migrate:

1. Cada cambio de schema genera una nueva migración versionada en `prisma/migrations/`
2. **Nunca** se modifican migraciones anteriores
3. Al iniciar la API, `MigrationService` ejecuta `prisma migrate deploy`
4. Se registra cada ejecución en `migration_logs`

```bash
# Crear nueva migración
npm run prisma:migrate -- --name descripcion_del_cambio

# Aplicar en producción
npm run prisma:migrate:deploy
```

## 4. Frontend Angular

### Estructura de carpetas

```
src/app/
├── core/           # Singleton services, guards, interceptors
│   ├── services/
│   ├── guards/
│   └── interceptors/
├── shared/         # Componentes reutilizables
│   └── components/
└── features/       # Módulos lazy-loaded por funcionalidad
    ├── auth/
    ├── pos/
    ├── admin/
    └── setup/
```

### Convenciones

- **Standalone components** (sin NgModules)
- **Lazy loading** en todas las rutas de features
- **Signals** para estado reactivo del POS
- **@ngx-translate** para i18n (español inicial)
- **Path aliases**: `@core/*`, `@shared/*`, `@features/*`, `@env/*`

## 5. Comunicación Electron ↔ NestJS

```
Renderer (Angular)
    │ HTTP REST + JWT
    ▼
NestJS API (localhost:3000)
    │
    ▼ (spawn al iniciar en modo SERVER/STANDALONE)
Electron Main Process
    │
    ▼
MySQL 8
```

En modo CLIENT, el renderer apunta a `http://{serverIP}:{port}/api/v1`.

### IPC Channels (Electron)

| Canal | Descripción |
|-------|-------------|
| `app:getConfig` | Obtener configuración local |
| `app:saveConfig` | Guardar configuración |
| `app:setMode` | Cambiar modo STANDALONE/SERVER/CLIENT |
| `discovery:findServers` | Descubrimiento mDNS en red local |
| `discovery:testConnection` | Validar conexión al servidor |

## 6. Seguridad

- **JWT** con access + refresh tokens
- **bcrypt** para hash de contraseñas (cost factor 12)
- **Guards** en cada endpoint: `JwtAuthGuard` + `PermissionsGuard`
- **Helmet** para headers HTTP seguros
- **Throttling** (200 req/min por IP)
- **HTTPS** preparado para producción (configurable)

## 7. Concurrencia Multi-Caja

- Múltiples cajas operan sobre la misma BD
- **Optimistic locking** con campo `version` en ventas e inventario
- Transacciones Prisma para checkout (descuento de stock atómico)
- Cada caja tiene `register_id` independiente
- Sesiones de caja (`register_sessions`) por usuario

## 8. Extensibilidad Futura

La estructura soporta sin cambios mayores:

| Funcionalidad | Preparación |
|--------------|-------------|
| Multi-empresa | Tabla `companies` + `company_id` en usuarios |
| Multi-sucursal | Tabla `branches` con `branch_id` en entidades |
| Facturación electrónica | Campos extensibles en `sales` + módulo futuro |
| Promociones/Combos | `ProductType.COMBO` + módulo `promotions` |
| Lotes/Seriales | Tablas adicionales referenciando `products` |
| API REST pública | Swagger ya configurado en `/api/docs` |
| App móvil | Misma API REST |
| Sincronización nube | Capa de infraestructura desacoplada |
| Actualizaciones auto | `electron-updater` configurado |

## 9. Convenciones de Código

### TypeScript
- `strict: true` en todos los tsconfig
- No usar `any`; preferir tipos de `@puntoventa/shared`
- Interfaces para DTOs; enums para estados

### Nombrado
- Archivos: `kebab-case.ts`
- Clases: `PascalCase`
- Variables/funciones: `camelCase`
- Permisos: `{modulo}.{accion}` (ej: `sales.void`)
- Tablas BD: `snake_case` (mapeadas con `@map` en Prisma)

### Git / Migraciones
- Una migración por cambio lógico de schema
- Nombres descriptivos: `20250626_add_promotions_table`
- Nunca editar migraciones ya aplicadas

## 10. Flujo de Autenticación

```
1. POST /api/v1/auth/login { username, password, registerId? }
2. API valida credenciales (bcrypt)
3. API carga permisos dinámicos desde BD
4. Retorna { accessToken, refreshToken, user, permissions[] }
5. Frontend almacena tokens en localStorage
6. Interceptor añade Authorization: Bearer {token}
7. PermissionsGuard valida permiso requerido por endpoint
8. POST /api/v1/auth/refresh para renovar access token
```

## 11. Flujo de Venta (POS)

```
1. Cajero abre sesión de caja (register_sessions)
2. Sistema carga pestañas activas (sales con status ACTIVE/SUSPENDED)
3. F1 → Nueva pestaña (nueva sale con tab_id único)
4. Búsqueda/escaneo → Agregar producto a sale_items
5. Auto-guardado con debounce (PUT /sales/:id con version)
6. F8 → Checkout → Transacción: validar stock, descontar inventario, registrar pagos
7. F5 → Suspender venta (status SUSPENDED, recuperable)
```

## 12. Rendimiento

- Lazy loading de rutas Angular
- Debounce en búsqueda de productos (200ms)
- Índices en columnas de búsqueda frecuente
- Paginación en todos los listados
- Signals para estado del POS (sin re-renders innecesarios)
- Pestañas como entidades ligeras (metadatos en memoria, detalle bajo demanda)

# PuntoVenta - Sistema POS Empresarial

Sistema Punto de Venta profesional para escritorio con arquitectura Cliente-Servidor, diseñado para escalar durante años.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Ionic 8 + Angular 20 + TypeScript |
| Desktop | Electron 35 + Electron Builder |
| Backend | NestJS 11 + TypeScript |
| Base de datos | MySQL 8 |
| ORM | Prisma 6 |
| Migraciones | Prisma Migrate |

## Arquitectura

```
puntoventa/
├── apps/
│   ├── api/          # Backend NestJS (Clean Architecture)
│   └── desktop/      # Electron (main, preload, empaquetado)
├── libs/
│   └── shared/       # Tipos, interfaces y constantes compartidas
├── prisma/           # Schema y migraciones versionadas
├── src/              # Frontend Ionic/Angular
└── docs/             # Documentación técnica
```

## Modos de Operación

### Modo Individual (STANDALONE)
Toda la aplicación corre localmente: Electron + Ionic + NestJS + MySQL.

### Modo Servidor (SERVER)
Equipo principal (Caja Maestra) ejecuta todo. Otras cajas se conectan vía API REST.

### Modo Cliente (CLIENT)
Caja cliente se conecta al servidor por red local. Sin base de datos local.

## Requisitos

- Node.js 20+
- MySQL 8.0+
- npm 10+

## Instalación

```bash
# Clonar e instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar DATABASE_URL en .env

# Crear base de datos
mysql -u root -p -e "CREATE DATABASE puntoventa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Ejecutar migraciones
npm run prisma:migrate

# Seed inicial (usuario admin, permisos, productos de ejemplo)
npm run prisma:seed
```

## Desarrollo

```bash
# API + Frontend web
npm run dev

# Solo API
npm run start:api

# Solo frontend
npm run start:web

# Electron completo
npm run dev:full
```

**Credenciales por defecto:** `admin` / `Admin123!`

## Empaquetado Windows

```bash
npm run dist:win
```

Eso compila shared, API, web y genera el instalador NSIS en `dist/installer/`.

Durante la instalación se pide la conexión MySQL y se escribe `installer.env` (también se copia a `%APPDATA%\PuntoVenta\.env`). El acceso directo del escritorio se crea automáticamente. La API empacada usa Electron como runtime Node (`ELECTRON_RUN_AS_NODE`).

Requisitos: MySQL en el PC destino. Genere `dist:win` preferentemente en **Windows** (módulos nativos: bcrypt / Prisma). Opcional: `apps/desktop/resources/icon.ico`.

## Módulos del Sistema

- Autenticación (JWT + refresh tokens)
- Usuarios, Roles y Permisos granulares (dinámicos en BD)
- Productos, Categorías, Clientes, Proveedores
- Ventas con pestañas múltiples y control de concurrencia
- Cajas (apertura, cierre, movimientos)
- Inventario y ajustes
- Compras
- Reportes
- Configuración del negocio
- Auditoría completa

## Atajos de Teclado (POS)

| Tecla | Acción |
|-------|--------|
| F1 | Nueva venta |
| F2 | Buscar producto |
| F3 | Cambiar cliente |
| F5 | Suspender venta |
| F8 | Cobrar |
| F10 | Cancelar venta |
| Ctrl+Tab | Siguiente pestaña |

## Documentación

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles de arquitectura, convenciones y guías de desarrollo.

## Licencia

Propietario — Todos los derechos reservados.

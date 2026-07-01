# Convenciones de Desarrollo - PuntoVenta

## Estructura de un nuevo módulo backend

1. Crear carpeta en `apps/api/src/modules/{nombre}/`
2. Implementar repository → service → controller → module
3. Registrar en `app.module.ts`
4. Agregar permisos en `libs/shared/src/constants/permissions.ts`
5. Ejecutar seed o migración para insertar permisos en BD
6. Crear ruta lazy en frontend si requiere UI

## Estructura de un nuevo módulo frontend

1. Crear feature en `src/app/features/{nombre}/`
2. Definir rutas en `{nombre}.routes.ts`
3. Registrar lazy route en `app.routes.ts`
4. Agregar traducciones en `src/assets/i18n/es.json`
5. Proteger con guards según permisos necesarios

## Crear una migración de BD

```bash
# 1. Modificar prisma/schema.prisma
# 2. Generar migración (NUNCA editar migraciones anteriores)
npm run prisma:migrate -- --name descripcion_cambio

# 3. Verificar SQL generado en prisma/migrations/
# 4. Probar en desarrollo
npm run prisma:migrate

# 5. En producción se aplica automáticamente al iniciar la API
```

## Agregar un permiso nuevo

1. Agregar en `DEFAULT_PERMISSIONS` en `libs/shared/src/constants/permissions.ts`
2. Ejecutar seed o crear migración de datos
3. Usar `@RequirePermissions('modulo.accion')` en el controller
4. Asignar al rol desde la UI de administración

## Testing de conexión Cliente-Servidor

1. Instalar en equipo servidor (modo SERVER)
2. Instalar en equipo cliente (modo CLIENT)
3. Usar descubrimiento automático o IP manual
4. Validar con "Probar conexión"
5. Verificar que `/api/v1/health` responde

## Checklist antes de release

- [ ] Migraciones aplicadas sin errores
- [ ] `npm run build:web` exitoso
- [ ] `npm run build:api` exitoso
- [ ] `npm run dist:win` genera instalador
- [ ] Login funcional con permisos
- [ ] POS: crear venta, agregar productos, cobrar
- [ ] Modo cliente conecta al servidor
- [ ] Auditoría registra operaciones críticas

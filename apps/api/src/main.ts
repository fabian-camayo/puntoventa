import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { BootstrapSeedService } from './infrastructure/database/bootstrap-seed.service';
import { prepareDatabase } from './infrastructure/database/prepare-database';
import { HttpExceptionFilter } from './presentation/filters/http-exception.filter';
import { TransformInterceptor } from './presentation/interceptors/transform.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL no definida. Configure MySQL en el instalador o en %APPDATA%\\PuntoVenta\\.env',
    );
  }

  // Crear BD si falta + migraciones ANTES de que Prisma conecte al arrancar Nest
  await prepareDatabase(databaseUrl);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bodyParser: false,
  });

  // Logos en base64 requieren más de 100 KB (límite por defecto de Express)
  app.use(json({ limit: '3mb' }));
  app.use(urlencoded({ extended: true, limit: '3mb' }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3000);
  const host = configService.get<string>('API_HOST', '0.0.0.0');

  const bootstrapSeed = app.get(BootstrapSeedService);
  await bootstrapSeed.ensureBaseData();

  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PuntoVenta API')
    .setDescription('API REST del sistema Punto de Venta')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, host);
  logger.log(`API ejecutándose en http://${host}:${port}/api/v1`);
  logger.log(`Documentación: http://${host}:${port}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  console.error('Error al iniciar la aplicación:', error);
  process.exit(1);
});

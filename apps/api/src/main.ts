import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { correlationIdMiddleware } from './presentation/middleware/correlation-id.middleware';

async function bootstrap() {
  // `rawBody: true` makes the exact raw request `Buffer` available at
  // `request.rawBody` (Express adapter) in every handler. The QStash webhook
  // controller needs this to verify `Upstash-Signature` against the exact
  // bytes that were signed — re-serializing the already-JSON-parsed body
  // could produce different whitespace/key ordering and break verification.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  // Registered before Nest binds any module-scoped middleware (nestjs-pino's
  // request logger included), so every downstream component — logger,
  // exception filter, handlers — observes the same correlation id.
  app.use(correlationIdMiddleware);

  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mini E-Commerce API')
    .setDescription('API Gateway/BFF for the Mini E-Commerce storefront and admin panel')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();

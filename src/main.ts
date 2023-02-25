import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './utils/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.enableCors({
      origin: '*',
      credentials: true,
  });
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true
  }))
  const logger = new Logger('Main')

  

  app.setGlobalPrefix('api/v1')
  setupSwagger(app)
  app.use(helmet())

  await app.listen(AppModule.port)


  // Log docs URL
  const baseUrl = AppModule.getBaseUrl(app)
  const url = `http://${baseUrl}:${AppModule.port}`;
  logger.log(`API Documentation available at ${url}/docs`);
}
bootstrap();

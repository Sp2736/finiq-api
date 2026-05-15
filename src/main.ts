import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  AllExceptionsFilter,
  ResponseInterceptor,
  LoggingInterceptor,
} from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors (order matters: logging -> response)
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, () => {
    console.log(`\n✅ Application running on: http://localhost:${port}\n`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    // Trigger reload for user management module
  });

}

bootstrap();

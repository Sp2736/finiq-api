import { Injectable, Logger } from '@nestjs/common';

/**
 * Health check service for monitoring
 */
@Injectable()
export class HealthService {
  private logger = new Logger(HealthService.name);

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }

  getReadiness() {
    return {
      ready: true,
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'running',
      },
    };
  }
}

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { reportRoutes } from './modules/github-report/report.routes.js';
import { accomplishmentRoutes } from './modules/accomplishment-report/accomplishment.routes.js';
import { sourceCodeRoutes } from './modules/source-code-report/source-code.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  // CORS configuration
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Sensible error helpers
  app.register(sensible);

  // Health check endpoint
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'github-development-report-generator',
      timestamp: new Date().toISOString(),
    };
  });

  // Register Report module routes
  app.register(reportRoutes);
  app.register(accomplishmentRoutes);
  app.register(sourceCodeRoutes);

  return app;
}

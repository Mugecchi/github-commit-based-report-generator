import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    console.log(`🚀 Fastify Server listening on ${address}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();

import { env } from './env';
import { logger } from './logger';
import { buildServer } from './server';
import { prisma } from './db';
import { redis } from './redis';
import { startExpiryJob } from './jobs/expirePrescriptions';

async function main() {
  const app = buildServer();
  const stopExpiry = startExpiryJob();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'core-api listening');
  });

  // Graceful shutdown — drain in-flight requests before closing pools.
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stopExpiry();
    server.close();
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  };
  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
  process.on('uncaughtException',  (err) => {
    logger.error({ err }, 'uncaughtException — exiting');
    process.exit(1);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

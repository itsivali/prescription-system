import { PrismaClient } from '@prisma/client';

// Single shared client. Prisma already pools connections internally.
export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

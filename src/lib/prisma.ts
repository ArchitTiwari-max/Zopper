import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Reconnect helper - use this in API routes that need resilience
export async function withReconnect<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isConnectionError = error?.code === 'P2010' || 
        error?.message?.includes('Connection reset') ||
        error?.message?.includes('Connection refused') ||
        error?.message?.includes('Server selection timeout');
      
      if (isConnectionError && attempt < retries) {
        console.warn(`[Prisma] Connection error, retrying (attempt ${attempt + 1}/${retries})...`);
        // Force disconnect and reconnect
        try { await prisma.$disconnect(); } catch {}
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        try { await prisma.$connect(); } catch {}
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}

import { PrismaClient } from '@prisma/client';

// إصلاح تسلسل الحقول من نوع BigInt في جيسون تلقائياً (مثل sync_version و file_size_bytes)
// لمنع حدوث TypeError: Do not know how to serialize a BigInt
if (typeof BigInt !== 'undefined') {
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
    return this.toString();
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

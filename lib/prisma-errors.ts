import { Prisma } from '@prisma/client';

/** Narrows a Prisma error to a specific known request error code. */
export function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

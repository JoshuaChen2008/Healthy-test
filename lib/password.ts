import { argon2id, hash, verify } from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const dummyHashPromise = hash('health-compass-invalid-password', ARGON2_OPTIONS);

/** Hashes a password using the OWASP Argon2id baseline selected by the design. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Verifies a password and performs a dummy hash check when no credential exists. */
export async function verifyPassword(
  passwordHash: string | null | undefined,
  password: string,
): Promise<boolean> {
  const digest = passwordHash ?? (await dummyHashPromise);

  try {
    const matches = await verify(digest, password);
    return passwordHash !== null && passwordHash !== undefined && matches;
  } catch {
    return false;
  }
}

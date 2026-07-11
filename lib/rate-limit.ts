import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';

const WINDOW_MS = 15 * 60 * 1_000;
const BLOCK_MS = 15 * 60 * 1_000;
const EMAIL_ATTEMPT_LIMIT = 5;
const IP_ATTEMPT_LIMIT = 20;

interface RateLimitRow {
  readonly attempt_count: number;
  readonly blocked_until: Date | null;
}

/** Consumes persistent IP and email authentication limits. */
export async function consumeAuthRateLimit(
  request: Request,
  email: string,
): Promise<boolean> {
  const ipAddress = getClientIp(request);
  const [isIpLimited, isEmailLimited] = await Promise.all([
    consumeBucket(`ip:${ipAddress}`, IP_ATTEMPT_LIMIT),
    consumeBucket(`email:${email}`, EMAIL_ATTEMPT_LIMIT),
  ]);

  return isIpLimited || isEmailLimited;
}

/** Clears the buckets after successful authentication. */
export async function clearAuthRateLimit(
  request: Request,
  email: string,
): Promise<void> {
  const ipAddress = getClientIp(request);
  const keys = [`ip:${ipAddress}`, `email:${email}`].map((value) =>
    createHash('sha256').update(value).digest('hex'),
  );

  try {
    await prisma.authRateLimit.deleteMany({
      where: { keyHash: { in: keys } },
    });
  } catch (error: unknown) {
    console.error('Failed to clear authentication rate limits.', error);
  }
}

async function consumeBucket(rawKey: string, limit: number): Promise<boolean> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - WINDOW_MS);
  const blockedUntil = new Date(now.getTime() + BLOCK_MS);
  const expiresAt = new Date(blockedUntil.getTime() + WINDOW_MS);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO auth_rate_limits (
      key_hash,
      attempt_count,
      window_started_at,
      blocked_until,
      expires_at,
      updated_at
    )
    VALUES (${keyHash}, 1, ${now}, NULL, ${expiresAt}, ${now})
    ON CONFLICT (key_hash) DO UPDATE SET
      attempt_count = CASE
        WHEN auth_rate_limits.window_started_at <= ${windowCutoff} THEN 1
        ELSE auth_rate_limits.attempt_count + 1
      END,
      window_started_at = CASE
        WHEN auth_rate_limits.window_started_at <= ${windowCutoff} THEN ${now}
        ELSE auth_rate_limits.window_started_at
      END,
      blocked_until = CASE
        WHEN auth_rate_limits.blocked_until > ${now} THEN auth_rate_limits.blocked_until
        WHEN auth_rate_limits.window_started_at > ${windowCutoff}
          AND auth_rate_limits.attempt_count + 1 > ${limit}
          THEN ${blockedUntil}
        ELSE NULL
      END,
      expires_at = ${expiresAt},
      updated_at = ${now}
    RETURNING attempt_count, blocked_until
  `;

  const row = rows[0];
  return row?.blocked_until !== null && row?.blocked_until !== undefined;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded !== null) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

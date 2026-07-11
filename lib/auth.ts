import { createHash, randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1_000;
const PRODUCTION_COOKIE_NAME = '__Host-health_session';
const DEVELOPMENT_COOKIE_NAME = 'health_session';

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

export interface SessionPrincipal {
  readonly sessionId: string;
  readonly userId: string;
  readonly email: string | null;
}

export interface CreatedSession {
  readonly token: string;
  readonly expiresAt: Date;
}

/** Returns the environment-specific name of the authentication cookie. */
export function getSessionCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

/** Creates a cryptographically random session and stores only its SHA-256 digest. */
export async function createSession(
  database: DatabaseClient,
  userId: string,
): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await database.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/** Resolves the current browser identity from its database-backed session cookie. */
export async function getSessionPrincipal(
  request: Request,
): Promise<SessionPrincipal | null> {
  const token = readCookie(request, getSessionCookieName());

  if (token === undefined) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (session === null) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
  };
}

/** Adds the secure session cookie to a response after the database transaction commits. */
export function setSessionCookie(
  response: NextResponse,
  session: CreatedSession,
): NextResponse {
  response.cookies.set({
    name: getSessionCookieName(),
    value: session.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
  return response;
}

/** Removes the browser session cookie without affecting other devices. */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: getSessionCookieName(),
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}

/** Hashes an opaque session token before lookup or storage. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie');

  if (cookieHeader === null) {
    return undefined;
  }

  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();

    if (key === name) {
      return value;
    }
  }

  return undefined;
}

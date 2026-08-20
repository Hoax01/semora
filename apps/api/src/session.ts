import type express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';

export async function requireUserId(request: express.Request, response: express.Response) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    response.status(401).json({ error: 'UNAUTHORIZED' });
    return undefined;
  }

  return session.user.id;
}

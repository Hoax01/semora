import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { checkDatabaseConnection } from './db.js';

export const app = express();

app.disable('x-powered-by');

app.all('/api/auth/*splat', toNodeHandler(auth));
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'api',
  });
});

app.get('/api/health/db', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    response.status(200).json({
      status: 'ok',
      service: 'database',
    });
  } catch {
    response.status(503).json({
      status: 'error',
      service: 'database',
    });
  }
});

app.get('/api/me', async (request, response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    response.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  response.status(200).json({ user: session.user });
});

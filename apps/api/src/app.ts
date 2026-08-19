import express from 'express';
import { checkDatabaseConnection } from './db.js';

export const app = express();

app.disable('x-powered-by');
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

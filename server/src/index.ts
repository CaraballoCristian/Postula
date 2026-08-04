import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { initDB } from './db';
import authRouter from './routes/auth';
import categoriasRouter from './routes/categorias';
import templatesRouter from './routes/templates';
import postulacionesRouter from './routes/postulaciones';
import configRouter from './routes/config';
import idiomasRouter from './routes/idiomas';
import tagsRouter from './routes/tags';
import backupRouter from './routes/backup';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Anti fuerza bruta SOLO sobre login y register. /me y /change-password quedan
// fuera del límite para no bloquear verificaciones de sesión frecuentes (F5).
const windowMin = Number(process.env.AUTH_RATE_WINDOW_MIN || 15);
const loginMax = Number(process.env.AUTH_LOGIN_RATE_MAX || 10);
const registerMax = Number(process.env.AUTH_REGISTER_RATE_MAX || 20);
const limitOpts = {
  windowMs: windowMin * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
};
app.use('/api/auth/login', rateLimit({ ...limitOpts, max: loginMax }));
app.use('/api/auth/register', rateLimit({ ...limitOpts, max: registerMax }));

initDB();

app.use('/api/auth', authRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/postulaciones', postulacionesRouter);
app.use('/api/config', configRouter);
app.use('/api/idiomas', idiomasRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/backup', backupRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// En producción (Docker), servir el cliente compilado + fallback SPA.
const CLIENT_DIST = process.env.CLIENT_DIST || '';
if (CLIENT_DIST && fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

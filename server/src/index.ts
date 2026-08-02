import express from 'express';
import cors from 'cors';
import { initDB } from './db';
import { seed } from './seed';
import categoriasRouter from './routes/categorias';
import templatesRouter from './routes/templates';
import postulacionesRouter from './routes/postulaciones';
import configRouter from './routes/config';
import idiomasRouter from './routes/idiomas';
import tagsRouter from './routes/tags';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

initDB();
seed();

app.use('/api/categorias', categoriasRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/postulaciones', postulacionesRouter);
app.use('/api/config', configRouter);
app.use('/api/idiomas', idiomasRouter);
app.use('/api/tags', tagsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

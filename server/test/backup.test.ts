import { describe, it, expect } from 'vitest';
import { createTestServer } from './helpers';
import request from 'supertest';

const srv = createTestServer();

describe('Backup', () => {
  it('export: devuelve las tablas del usuario sin columna user_id', async () => {
    const token = await srv.auth('bk@test.com');
    await request(srv.app).post('/api/postulaciones').set('Authorization', `Bearer ${token}`).send({
      empresa: 'EmpresaBackup',
      oferta_laboral: 'Frontend',
      estado: 'solicitado',
    });

    const res = await request(srv.app).get('/api/backup/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const keys = Object.keys(res.body);
    for (const k of ['categorias', 'templates', 'config', 'idiomas', 'tags', 'postulaciones', 'empresas']) {
      expect(keys).toContain(k);
    }
    expect(res.body.postulaciones.some((p: any) => p.empresa === 'EmpresaBackup')).toBe(true);
    for (const p of res.body.postulaciones) {
      expect(p.user_id).toBeUndefined();
    }
    expect(res.body.tags.some((t: any) => t.user_id !== undefined)).toBe(false);
  });

  it('preview: 400 con data inválida, {groups} con data válida', async () => {
    const token = await srv.auth('bk2@test.com');

    const bad = await request(srv.app).post('/api/backup/preview').set('Authorization', `Bearer ${token}`).send({ data: null });
    expect(bad.status).toBe(400);

    const exp = await request(srv.app).get('/api/backup/export').set('Authorization', `Bearer ${token}`);
    const ok = await request(srv.app).post('/api/backup/preview').set('Authorization', `Bearer ${token}`).send({ data: exp.body });
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.groups)).toBe(true);
  });

  it('import: restaura postulaciones, categorías e idiomas del backup en otra cuenta', async () => {
    const tokenA = await srv.auth('bk-a@test.com');
    const tokenB = await srv.auth('bk-b@test.com');

    const cat = await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${tokenA}`).send({ nombre: 'SecUndaria' });
    await request(srv.app).post('/api/postulaciones').set('Authorization', `Bearer ${tokenA}`).send({
      empresa: 'EmpresaA',
      oferta_laboral: 'Backend',
      categoria_id: cat.body.id,
      estado: 'en_proceso',
      nombre_empleado: 'Ana',
    });

    const exp = await request(srv.app).get('/api/backup/export').set('Authorization', `Bearer ${tokenA}`);

    const imp = await request(srv.app).post('/api/backup/import').set('Authorization', `Bearer ${tokenB}`).send({ data: exp.body });
    expect(imp.status).toBe(200);

    const postsB = await request(srv.app).get('/api/postulaciones').set('Authorization', `Bearer ${tokenB}`);
    const imported = postsB.body.find((p: any) => p.empresa === 'EmpresaA');
    expect(imported).toBeTruthy();
    expect(imported.oferta_laboral).toBe('Backend');
    expect(imported.nombre_empleado).toBe('Ana');

    const catsB = await request(srv.app).get('/api/categorias').set('Authorization', `Bearer ${tokenB}`);
    expect(catsB.body.some((c: any) => c.nombre === 'SecUndaria')).toBe(true);
  });

  it('import: una postulación ya existente se conserva si la decisión es existing', async () => {
    const tokenA = await srv.auth('bk-c@test.com');
    const tokenB = await srv.auth('bk-d@test.com');

    // Cuenta A: postulación "MismaEmpresa" que se exportará.
    await request(srv.app).post('/api/postulaciones').set('Authorization', `Bearer ${tokenA}`).send({
      empresa: 'MismaEmpresa',
      oferta_laboral: 'Frontend',
      estado: 'en_proceso',
      notas: 'nota de la cuenta A',
    });

    // B importa el backup de A (trae esa postulación).
    const expSrc = await request(srv.app).get('/api/backup/export').set('Authorization', `Bearer ${tokenA}`);
    const imp = await request(srv.app).post('/api/backup/import').set('Authorization', `Bearer ${tokenB}`).send({ data: expSrc.body });
    expect(imp.status).toBe(200);

    // B edita la postulación importada (mismos dedup key, campos internos distintos).
    const postsB = await request(srv.app).get('/api/postulaciones').set('Authorization', `Bearer ${tokenB}`);
    const importedPost = postsB.body.find((p: any) => p.empresa === 'MismaEmpresa');
    expect(importedPost).toBeTruthy();
    const edit = await request(srv.app)
      .put(`/api/postulaciones/${importedPost.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ notas: 'nota local editada', estado: 'rechazado' });
    expect(edit.status).toBe(200);

    // Re-export de B' (contiene la postulación editada) y decisión: conservar la existente.
    const expB = await request(srv.app).get('/api/backup/export').set('Authorization', `Bearer ${tokenB}`);
    const imp2 = await request(srv.app).post('/api/backup/import').set('Authorization', `Bearer ${tokenB}`).send({
      data: expB.body,
      decisions: { 'mismaempresa': { link: 'existing', mensaje: 'existing', posts: {} } },
    });
    expect(imp2.status).toBe(200);

    const finalPosts = await request(srv.app).get('/api/postulaciones').set('Authorization', `Bearer ${tokenB}`);
    const only = finalPosts.body.filter((p: any) => p.empresa === 'MismaEmpresa');
    // La postulación local editada debe conservarse intacta y sin duplicar.
    expect(only.length).toBe(1);
    expect(only[0].estado).toBe('rechazado');
    expect(only[0].notas).toBe('nota local editada');
  });
});
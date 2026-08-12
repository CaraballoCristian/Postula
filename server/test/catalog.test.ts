import { describe, it, expect } from 'vitest';
import { createTestServer } from './helpers';
import request from 'supertest';

const srv = createTestServer();

describe('Categorías', () => {
  it('POST crea y GET lista (con seed Tech/Management)', async () => {
    const token = await srv.auth('cat@test.com');
    const list1 = await request(srv.app).get('/api/categorias').set('Authorization', `Bearer ${token}`);
    expect(list1.status).toBe(200);
    expect(list1.body.some((c: any) => c.nombre === 'Tech')).toBe(true);

    const res = await request(srv.app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: '   Marketing  ' });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Marketing');

    const list2 = await request(srv.app).get('/api/categorias').set('Authorization', `Bearer ${token}`);
    expect(list2.body.some((c: any) => c.nombre === 'Marketing')).toBe(true);
  });

  it('POST duplicado → 409', async () => {
    const token = await srv.auth('cat2@test.com');
    await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nombre: 'Design' });
    const res = await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nombre: 'Design' });
    expect(res.status).toBe(409);
  });

  it('POST nombre vacío → 400', async () => {
    const token = await srv.auth('cat3@test.com');
    const res = await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nombre: '  ' });
    expect(res.status).toBe(400);
  });

  it('PUT/:id/default guarda default_categoria_id', async () => {
    const token = await srv.auth('cat4@test.com');
    const created = await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nombre: 'Default1' });
    const res = await request(srv.app)
      .put(`/api/categorias/${created.body.id}/default`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const cfg = await request(srv.app).get('/api/config').set('Authorization', `Bearer ${token}`);
    const entry = cfg.body.find((e: any) => e.clave === 'default_categoria_id');
    expect(Number(entry.valor)).toBe(created.body.id);
  });

  it('PUT renombra', async () => {
    const token = await srv.auth('cat5@test.com');
    const created = await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nombre: 'Viejo' });
    const res = await request(srv.app)
      .put(`/api/categorias/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Nuevo' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Nuevo');
  });

  it('DELETE sin uso → 200 ok', async () => {
    const token = await srv.auth('cat6@test.com');
    const created = await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${token}`).send({ nombre: 'AEmborrar' });
    const res = await request(srv.app).delete(`/api/categorias/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('aislamiento: otro usuario no ve mis categorías', async () => {
    const tokenA = await srv.auth('iso-a@test.com');
    const tokenB = await srv.auth('iso-b@test.com');
    await request(srv.app).post('/api/categorias').set('Authorization', `Bearer ${tokenA}`).send({ nombre: 'SoloDeA' });
    const listB = await request(srv.app).get('/api/categorias').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.some((c: any) => c.nombre === 'SoloDeA')).toBe(false);
  });
});

describe('Idiomas', () => {
  it('POST crea, duplicado → 409, default guarda nombre', async () => {
    const token = await srv.auth('idi@test.com');
    const created = await request(srv.app).post('/api/idiomas').set('Authorization', `Bearer ${token}`).send({ nombre: 'PT' });
    expect(created.status).toBe(201);

    const dup = await request(srv.app).post('/api/idiomas').set('Authorization', `Bearer ${token}`).send({ nombre: 'PT' });
    expect(dup.status).toBe(409);

    const def = await request(srv.app).put(`/api/idiomas/${created.body.id}/default`).set('Authorization', `Bearer ${token}`);
    expect(def.status).toBe(200);

    const cfg = await request(srv.app).get('/api/config').set('Authorization', `Bearer ${token}`);
    const entry = cfg.body.find((e: any) => e.clave === 'default_idioma');
    expect(entry.valor).toBe('PT');
  });
});

describe('Config', () => {
  it('POST valida clave: 201 válida, 400 vacía/reservada, 409 duplicada', async () => {
    const token = await srv.auth('cfg@test.com');
    const ok = await request(srv.app).post('/api/config').set('Authorization', `Bearer ${token}`).send({ clave: 'mi_dato', valor: 'hola' });
    expect(ok.status).toBe(201);

    const empty = await request(srv.app).post('/api/config').set('Authorization', `Bearer ${token}`).send({ clave: '   ', valor: 'x' });
    expect(empty.status).toBe(400);

    // Claves reservadas (default_*) no se pueden escribir desde la API.
    const reserved = await request(srv.app).post('/api/config').set('Authorization', `Bearer ${token}`).send({ clave: 'default_categoria_id', valor: '2' });
    expect(reserved.status).toBe(400);

    const dup = await request(srv.app).post('/api/config').set('Authorization', `Bearer ${token}`).send({ clave: 'mi_dato', valor: 'otro' });
    expect(dup.status).toBe(409);
  });

  it('PUT actualiza y DELETE no deja borrar claves reservadas', async () => {
    const token = await srv.auth('cfg2@test.com');
    const created = await request(srv.app).post('/api/config').set('Authorization', `Bearer ${token}`).send({ clave: 'apodo', valor: 'a' });
    expect(created.status).toBe(201);

    const upd = await request(srv.app).put(`/api/config/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ valor: 'b' });
    expect(upd.status).toBe(200);
    expect(upd.body.valor).toBe('b');

    const delReserved = await request(srv.app).get('/api/config').set('Authorization', `Bearer ${token}`);
    const defEntry = delReserved.body.find((e: any) => e.clave === 'default_categoria_id');
    const del = await request(srv.app).delete(`/api/config/${defEntry.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(400);

    const delOk = await request(srv.app).delete(`/api/config/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(delOk.status).toBe(200);
  });
});
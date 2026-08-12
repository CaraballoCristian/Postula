import { describe, it, expect } from 'vitest';
import { createTestServer } from './helpers';
import request from 'supertest';

const srv = createTestServer();

/** Crea un tag y una postulación con ese tag como estado. Devuelve { tag, post } y token. */
async function seedTagYPostulacion(token: string) {
  const tag = await request(srv.app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'entrevista', color: '#ff0000' });
  expect(tag.status).toBe(201);

  const post = await request(srv.app)
    .post('/api/postulaciones')
    .set('Authorization', `Bearer ${token}`)
    .send({
      empresa: 'Empresa Test',
      oferta_laboral: 'Backend',
      nombre_empleado: 'Juan',
      estado: 'entrevista',
    });
  expect(post.status).toBe(201);

  return { tag: tag.body, post: post.body };
}

describe('Tags', () => {
  it('POST normaliza a slug (mayúsculas → minúsculas, espacios → _)', async () => {
    const token = await srv.auth('tag@test.com');
    const res = await request(srv.app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'En Proceso 2', color: '#00f' });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('en_proceso_2');
  });

  it('POST duplicado → 409', async () => {
    const token = await srv.auth('tag2@test.com');
    await request(srv.app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ nombre: 'oferta' });
    const res = await request(srv.app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ nombre: 'OFERTA' });
    expect(res.status).toBe(409);
  });

  it('delete con body.dest reasigna postulaciones y borra el tag', async () => {
    const token = await srv.auth('tag3@test.com');
    const { tag, post } = await seedTagYPostulacion(token);
    const dest = await request(srv.app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ nombre: 'finalizado' });
    expect(dest.status).toBe(201);

    const del = await request(srv.app)
      .delete(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dest: dest.body.id });
    expect(del.status).toBe(200);
    expect(del.body.affectedPostulaciones).toBe(1);

    const got = await request(srv.app).get(`/api/postulaciones/${post.id}`).set('Authorization', `Bearer ${token}`);
    expect(got.body.estado).toBe('finalizado');
  });

  it('delete sin dest: 200 sin usos, 400 si está en uso', async () => {
    const token = await srv.auth('tag4@test.com');
    const t = await request(srv.app).post('/api/tags').set('Authorization', `Bearer ${token}`).send({ nombre: 'sinusos' });
    const delOk = await request(srv.app).delete(`/api/tags/${t.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(delOk.status).toBe(200);

    const { tag } = await seedTagYPostulacion(token);
    const delBlocked = await request(srv.app).delete(`/api/tags/${tag.id}`).set('Authorization', `Bearer ${token}`);
    expect(delBlocked.status).toBe(400);
  });

  it('PUT rename con propagate=true actualiza postulaciones.estado', async () => {
    const token = await srv.auth('tag5@test.com');
    const { tag, post } = await seedTagYPostulacion(token);

    const res = await request(srv.app)
      .put(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'segunda_entrevista', propagate: true });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('segunda_entrevista');
    expect(res.body.affectedPostulaciones).toBe(1);

    const got = await request(srv.app).get(`/api/postulaciones/${post.id}`).set('Authorization', `Bearer ${token}`);
    expect(got.body.estado).toBe('segunda_entrevista');
  });

  it('PUT rename sin propagate igual propaga: la FK ON UPDATE CASCADE renombra las postulaciones', async () => {
    const token = await srv.auth('tag6@test.com');
    const { tag, post } = await seedTagYPostulacion(token);

    const res = await request(srv.app)
      .put(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'renombrado_sin_prop' });
    expect(res.status).toBe(200);

    // Nota de diseño: aunque el flag `propagate` esté en false, el rename del tag
    // propaga igual a postulaciones.estado por la FK ON UPDATE CASCADE del esquema.
    // `affectedPostulaciones` solo se reporta cuando propagate === true.
    const got = await request(srv.app).get(`/api/postulaciones/${post.id}`).set('Authorization', `Bearer ${token}`);
    expect(got.body.estado).toBe('renombrado_sin_prop');
  });

  it('aislamiento: postulaciones de A no cambian al renombrar tag de otro usuario', async () => {
    const tokenA = await srv.auth('tagiso-a@test.com');
    const tokenB = await srv.auth('tagiso-b@test.com');
    const { tag, post } = await seedTagYPostulacion(tokenA);

    const res = await request(srv.app)
      .put(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ nombre: 'hackeado', propagate: true });
    expect([200, 404]).toContain(res.status);

    const got = await request(srv.app).get(`/api/postulaciones/${post.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(got.body.estado).toBe('entrevista');
  });
});
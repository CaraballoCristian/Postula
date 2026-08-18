import { describe, it, expect } from 'vitest';
import { createTestServer } from './helpers';
import request from 'supertest';

const srv = createTestServer();

describe('Empresas', () => {
  it('POST /empresas trimea nombre y link', async () => {
    const token = await srv.auth('emp-trim@test.com');
    const res = await request(srv.app)
      .post('/api/empresas')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: '  Delta  ', link: '  https://delta.com  ' });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Delta');
    expect(res.body.link).toBe('https://delta.com');
  });

  it('POST /postulaciones trimea empresa/empleado y guarda el mensaje en empresas', async () => {
    const token = await srv.auth('emp-post@test.com');
    const res = await request(srv.app)
      .post('/api/postulaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empresa: '  Acme Corp  ',
        oferta_laboral: '  Dev Ssr  ',
        nombre_empleado: '  Ana  ',
        puesto_empleado: '  Backend  ',
        resultado_empresa: '  Hola empresa!  ',
        estado: 'solicitado',
      });
    expect(res.status).toBe(201);
    expect(res.body.empresa).toBe('Acme Corp');
    expect(res.body.oferta_laboral).toBe('Dev Ssr');
    expect(res.body.nombre_empleado).toBe('Ana');
    expect(res.body.puesto_empleado).toBe('Backend');

    const empresas = await request(srv.app).get('/api/empresas').set('Authorization', `Bearer ${token}`);
    const e = empresas.body.find((x: any) => x.nombre === 'Acme Corp');
    expect(e).toBeTruthy();
    expect(e.resultado_empresa).toBe('Hola empresa!');
  });

  it('PUT /postulaciones trimea los campos core', async () => {
    const token = await srv.auth('emp-put@test.com');
    const created = await request(srv.app)
      .post('/api/postulaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ empresa: 'Beta', oferta_laboral: 'A', nombre_empleado: 'Pepe', puesto_empleado: 'X' });

    const res = await request(srv.app)
      .put(`/api/postulaciones/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre_empleado: '  Pepe Luis  ', puesto_empleado: '  Lead  ', oferta_laboral: '  B  ' });
    expect(res.status).toBe(200);
    expect(res.body.nombre_empleado).toBe('Pepe Luis');
    expect(res.body.puesto_empleado).toBe('Lead');
    expect(res.body.oferta_laboral).toBe('B');
  });

  it('al borrar la última postulación activa, la empresa permanece (borrado manual desde vista empresa)', async () => {
    const token = await srv.auth('emp-del@test.com');
    const created = await request(srv.app)
      .post('/api/postulaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ empresa: 'Gamma', resultado_empresa: 'msg gamma' });
    expect(created.status).toBe(201);

    let empresas = await request(srv.app).get('/api/empresas').set('Authorization', `Bearer ${token}`);
    const gamma = empresas.body.find((x: any) => x.nombre === 'Gamma');
    expect(gamma).toBeTruthy();
    expect(gamma.resultado_empresa).toBe('msg gamma');

    // Soft delete de la única postulación: la empresa NO se auto-elimina.
    const del = await request(srv.app).delete(`/api/postulaciones/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    empresas = await request(srv.app).get('/api/empresas').set('Authorization', `Bearer ${token}`);
    expect(empresas.body.some((x: any) => x.nombre === 'Gamma')).toBe(true);

    // Borrado manual (DELETE /empresas/:id): elimina la empresa y manda sus postulaciones a la papelera.
    const restore = await request(srv.app).post(`/api/postulaciones/${created.body.id}/restore`).set('Authorization', `Bearer ${token}`);
    expect(restore.status).toBe(200);
    const delEmp = await request(srv.app).delete(`/api/empresas/${gamma.id}`).set('Authorization', `Bearer ${token}`);
    expect(delEmp.status).toBe(200);
    expect(delEmp.body.affectedPostulaciones).toBe(1);

    empresas = await request(srv.app).get('/api/empresas').set('Authorization', `Bearer ${token}`);
    expect(empresas.body.some((x: any) => x.nombre === 'Gamma')).toBe(false);
  });

  it('aislamiento: un usuario no ve las empresas de otro', async () => {
    const tokenA = await srv.auth('emp-iso-a@test.com');
    const tokenB = await srv.auth('emp-iso-b@test.com');
    await request(srv.app)
      .post('/api/empresas')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'SoloDeA' });
    const listB = await request(srv.app).get('/api/empresas').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.some((x: any) => x.nombre === 'SoloDeA')).toBe(false);
  });
});
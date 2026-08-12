import { describe, it, expect } from 'vitest';
import { createTestServer } from './helpers';
import request from 'supertest';

const srv = createTestServer();

describe('POST /api/auth/register', () => {
  it('201 con token y usuario', async () => {
    const res = await request(srv.app)
      .post('/api/auth/register')
      .send({ email: 'nuevo@test.com', password: 'Secreto-123!' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('nuevo@test.com');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('409 EMAIL_EXISTS si el email ya está registrado (case-insensitive)', async () => {
    await request(srv.app).post('/api/auth/register').send({ email: 'dup@test.com', password: 'Secreto-123!' });
    const res = await request(srv.app).post('/api/auth/register').send({ email: 'DUP@test.com', password: 'Otro-123!' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_EXISTS');
  });

  it('400 EMAIL_INVALID si el email no es válido', async () => {
    const res = await request(srv.app).post('/api/auth/register').send({ email: 'no-es-email', password: 'Secreto-123!' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('EMAIL_INVALID');
  });

  it('400 si la password es débil', async () => {
    const res = await request(srv.app).post('/api/auth/register').send({ email: 'weak@test.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PASSWORD/);
  });
});

describe('POST /api/auth/login', () => {
  it('200 con token si las credenciales son correctas', async () => {
    await request(srv.app).post('/api/auth/register').send({ email: 'login@test.com', password: 'Secreto-123!' });
    const res = await request(srv.app).post('/api/auth/login').send({ email: 'login@test.com', password: 'Secreto-123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('401 INVALID_CREDENTIALS con password incorrecta', async () => {
    await request(srv.app).post('/api/auth/register').send({ email: 'login2@test.com', password: 'Secreto-123!' });
    const res = await request(srv.app).post('/api/auth/login').send({ email: 'login2@test.com', password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me', () => {
  it('200 con usuario válido y token', async () => {
    const token = await srv.auth('me@test.com');
    const res = await request(srv.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('401 sin token', async () => {
    const res = await request(srv.app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('200 ok y permite login con la nueva password', async () => {
    const token = await srv.auth('pw@test.com');
    const res = await request(srv.app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Str0ng-pass-123', newPassword: 'Nueva-pass-456' });
    expect(res.status).toBe(200);

    const oldLogin = await request(srv.app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'Str0ng-pass-123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(srv.app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'Nueva-pass-456' });
    expect(newLogin.status).toBe(200);
  });

  it('400 CURRENT_PASSWORD_INCORRECT si la actual no coincide', async () => {
    const token = await srv.auth('pw2@test.com');
    const res = await request(srv.app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'mal', newPassword: 'Nueva-pass-456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CURRENT_PASSWORD_INCORRECT');
  });

  it('400 PASSWORD_SAME si la nueva es igual a la actual', async () => {
    const token = await srv.auth('pw3@test.com');
    const res = await request(srv.app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Str0ng-pass-123', newPassword: 'Str0ng-pass-123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PASSWORD_SAME');
  });
});
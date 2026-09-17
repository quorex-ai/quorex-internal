import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, sessionCookie, TEST_PASSWORD, type TestContext } from './helpers.js';
import { loadEnv } from '../src/env.js';

describe('authentification', () => {
  let context: TestContext;
  let directory: string;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quorex-test-'));
    context = await createTestContext(directory);
  });

  afterEach(() => {
    context.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('ouvre une session avec les bons identifiants', async () => {
    const response = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'clement', password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.login).toBe('clement');

    const cookie = (response.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('refuse un mauvais mot de passe sans distinguer le compte inconnu', async () => {
    const wrongPassword = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'clement', password: 'faux' });
    const unknownLogin = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'inconnu', password: 'faux' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownLogin.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownLogin.body);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
  });

  it('limite a cinq tentatives par quart d’heure et par IP', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(context.app)
        .post('/api/auth/login')
        .send({ login: 'clement', password: 'faux' });
      expect(response.status).toBe(401);
    }

    const blocked = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'clement', password: TEST_PASSWORD });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('refuse toute route protegee sans session valide', async () => {
    const me = await request(context.app).get('/api/auth/me');
    expect(me.status).toBe(401);

    const milestones = await request(context.app).get('/api/milestones');
    expect(milestones.status).toBe(401);
    expect(milestones.body.error.code).toBe('UNAUTHORIZED');

    const forged = await request(context.app)
      .get('/api/milestones')
      .set('Cookie', 'quorex_session=jeton-invente');
    expect(forged.status).toBe(401);
  });

  it('laisse passer avec une session, et la ferme au logout', async () => {
    const login = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'clement', password: TEST_PASSWORD });
    const cookie = sessionCookie(login.headers['set-cookie'] as unknown as string[]);

    const allowed = await request(context.app).get('/api/milestones').set('Cookie', cookie);
    expect(allowed.status).toBe(200);

    await request(context.app).post('/api/auth/logout').set('Cookie', cookie).expect(204);

    const after = await request(context.app).get('/api/milestones').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  it('refuse de demarrer sans secret de session solide', () => {
    expect(() => loadEnv({ SESSION_SECRET: '' })).toThrow(/SESSION_SECRET/);
    expect(() => loadEnv({ SESSION_SECRET: 'trop-court' })).toThrow(/32 caracteres/);
    expect(() => loadEnv({ SESSION_SECRET: 'x'.repeat(32) })).not.toThrow();
  });

  it('la sante repond sans session', async () => {
    const response = await request(context.app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

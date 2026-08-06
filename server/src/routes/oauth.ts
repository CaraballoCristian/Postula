import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db';
import { signToken, hashPassword, findUserByEmail, findUserById } from '../auth';
import { seedForUser } from '../seed';

const router = Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error('GOOGLE_CLIENT_ID no está configurado');
  return id;
}

function googleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('GOOGLE_CLIENT_SECRET no está configurado');
  return secret;
}

/** Deriva la redirect_uri correcta según el request (local y prod sin hardcodear). */
function redirectUri(req: Request): string {
  return `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

function publicUser(row: any) {
  return { id: row.id, email: row.email, created_at: row.created_at };
}

/** Redirect relativo: el navegador lo resuelve sobre la URL actual, evitando
 * depender del protocolo/host percibido tras el proxy (y posibles loops http/https). */
function frontendRedirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query).toString();
  return params ? `/?${params}` : '/';
}

const OAUTH_STATE_COOKIE = 'postulatool_oauth_state';

router.get('/google', (req: Request, res: Response) => {
  const state = crypto.randomBytes(24).toString('hex');
  const secure = req.protocol === 'https';
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email',
    state,
    prompt: 'select_account',
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;

  // Cancelación por el usuario.
  if (error) {
    return res.redirect(frontendRedirect({ oauth_error: '1' }));
  }

  const stored = (req.cookies && req.cookies[OAUTH_STATE_COOKIE]) as string | undefined;
  res.clearCookie(OAUTH_STATE_COOKIE, { httpOnly: true, secure: req.protocol === 'https', sameSite: 'lax', path: '/' });

  if (!code || !state || !stored || state !== stored) {
    return res.redirect(frontendRedirect({ oauth_error: '1' }));
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return res.redirect(frontendRedirect({ oauth_error: '1' }));
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return res.redirect(frontendRedirect({ oauth_error: '1' }));
    }

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) {
      return res.redirect(frontendRedirect({ oauth_error: '1' }));
    }
    const info = (await infoRes.json()) as {
      email?: string;
      email_verified?: boolean;
    };

    if (!info.email || info.email_verified !== true) {
      return res.redirect(frontendRedirect({ oauth_error: '1' }));
    }

    const email = info.email.trim().toLowerCase();
    let user = findUserByEmail(email);

    if (!user) {
      // Nuevo usuario vía Google: hash descartable (no puede iniciar sesión con password).
      const randomHash = hashPassword(crypto.randomBytes(24).toString('hex'));
      const { lastInsertRowid } = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, randomHash);
      const userId = Number(lastInsertRowid);
      try {
        seedForUser(userId);
      } catch (e) {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        console.error('Fallo el seed del usuario OAuth', e);
        return res.redirect(frontendRedirect({ oauth_error: '1' }));
      }
      user = findUserById(userId);
    }

    const token = signToken({ id: user.id, email: user.email });
    return res.redirect(frontendRedirect({
      oauth_token: token,
      oauth_email: user.email,
      oauth_id: String(user.id),
    }));
  } catch (e) {
    console.error('Error en callback de Google OAuth', e);
    return res.redirect(frontendRedirect({ oauth_error: '1' }));
  }
});

export default router;
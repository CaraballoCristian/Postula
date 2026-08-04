import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'postulatool-dev-secret-cambiar-en-produccion';
const JWT_EXPIRES_IN = '30d';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción. Definilo en el entorno antes de arrancar.');
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

// Contraseñas comunes/secuenciales que se rechazan al registrar o cambiar password.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'qwerty', 'qwerty123', 'abc123', 'abc12345',
  'letmein', 'welcome', 'admin', 'admin123', 'administrator',
  'iloveyou', 'monkey', 'dragon', 'master', 'login', 'princess',
  'football', 'baseball', 'sunshine', 'charlie', 'trustno1', 'shadow',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  '123123', '123qwe', '111111', '000000', '654321', '666666', '888888', '999999',
]);

export type PasswordError = 'PASSWORD_TOO_SHORT' | 'PASSWORD_TOO_LONG' | 'PASSWORD_COMMON' | null;

export function validatePassword(password: string): PasswordError {
  if (password.length < PASSWORD_MIN_LENGTH) return 'PASSWORD_TOO_SHORT';
  if (password.length > PASSWORD_MAX_LENGTH) return 'PASSWORD_TOO_LONG';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'PASSWORD_COMMON';
  return null;
}

export interface UserPayload {
  id: number;
  email: string;
}

export function signToken(user: UserPayload): string {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    return payload && typeof payload.id === 'number' ? payload : null;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function checkPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export function findUserByEmail(email: string): any {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

export function findUserById(id: number): any {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

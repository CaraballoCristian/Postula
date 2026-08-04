import { Injectable, signal, computed } from '@angular/core';
import { User } from '../models/interfaces';

const TOKEN_KEY = 'postulatool.token';
const USER_KEY = 'postulatool.user';

@Injectable({ providedIn: 'root' })
export class SessionService {
  token = signal<string | null>(null);
  user = signal<User | null>(null);
  /** true cuando ya se validó el token almacenado (o no había token). Evita un flash del login. */
  ready = signal(false);

  isAuthenticated = computed(() => !!this.token());

  constructor() {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      this.token.set(savedToken);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) {
        try { this.user.set(JSON.parse(savedUser)); } catch { /* ignorar */ }
      }
    } else {
      this.ready.set(true);
    }
  }

  setSession(token: string, user: User) {
    this.token.set(token);
    this.user.set(user);
    this.persist();
    this.ready.set(true);
  }

  logout() {
    this.token.set(null);
    this.user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private persist() {
    localStorage.setItem(TOKEN_KEY, this.token()!);
    localStorage.setItem(USER_KEY, JSON.stringify(this.user()));
  }
}

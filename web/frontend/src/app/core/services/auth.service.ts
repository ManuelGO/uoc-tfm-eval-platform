import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  id: string;
  email: string;
  [key: string]: any;
}

/**
 * Authentication Service
 *
 * Centralizes all authentication-related logic including:
 * - Token management (get, set, clear)
 * - User data management
 * - Authentication state validation
 * - JWT token expiration checking
 *
 * Benefits:
 * - SSR-compatible (checks for browser platform before accessing localStorage)
 * - Easy to test (single source of truth)
 * - Centralized logic (no duplication across components)
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly TOKEN_KEY = 'authToken';
  private readonly USER_KEY = 'user';
  private readonly RETURN_URL_KEY = 'returnUrl';

  /**
   * Check if code is running in browser (not SSR)
   */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Get the authentication token from localStorage
   * @returns The token string or null if not found
   */
  getToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Save the authentication token to localStorage
   * @param token - The JWT token to save
   */
  setToken(token: string): void {
    if (!this.isBrowser) {
      return;
    }
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Remove the authentication token from localStorage
   */
  clearToken(): void {
    if (!this.isBrowser) {
      return;
    }
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Get the current user data from localStorage
   * @returns The user object or null if not found
   */
  getUser(): User | null {
    if (!this.isBrowser) {
      return null;
    }
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) {
      return null;
    }
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }

  /**
   * Save user data to localStorage
   * @param user - The user object to save
   */
  setUser(user: User): void {
    if (!this.isBrowser) {
      return;
    }
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Remove user data from localStorage
   */
  clearUser(): void {
    if (!this.isBrowser) {
      return;
    }
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Clear all authentication data (token and user)
   */
  logout(): void {
    this.clearToken();
    this.clearUser();
    this.clearReturnUrl();
  }

  /**
   * Get the return URL from sessionStorage
   * @returns The return URL or null if not found
   */
  getReturnUrl(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return sessionStorage.getItem(this.RETURN_URL_KEY);
  }

  /**
   * Save the return URL to sessionStorage
   * @param url - The URL to return to after authentication
   */
  setReturnUrl(url: string): void {
    if (!this.isBrowser) {
      return;
    }
    sessionStorage.setItem(this.RETURN_URL_KEY, url);
  }

  /**
   * Remove the return URL from sessionStorage
   */
  clearReturnUrl(): void {
    if (!this.isBrowser) {
      return;
    }
    sessionStorage.removeItem(this.RETURN_URL_KEY);
  }

  /**
   * Check if the user is authenticated
   * @returns true if a valid token exists and is not expired
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    // Check if token is expired
    return !this.isTokenExpired(token);
  }

  /**
   * Check if a JWT token is expired
   * @param token - The JWT token to check
   * @returns true if the token is expired or invalid
   */
  private isTokenExpired(token: string): boolean {
    try {
      // JWT structure: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid token format
      }

      // Decode the payload (base64url)
      const payload = JSON.parse(atob(parts[1]));

      // Check if exp claim exists
      if (!payload.exp) {
        // If no expiration, consider it as non-expired
        // (You might want to change this based on your security requirements)
        return false;
      }

      // exp is in seconds, Date.now() is in milliseconds
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();

      return currentTime >= expirationTime;
    } catch {
      // If we can't decode the token, consider it expired/invalid
      return true;
    }
  }
}

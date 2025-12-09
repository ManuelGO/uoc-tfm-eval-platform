import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly config: AppConfig = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private get baseUrl(): string {
    return this.config.apiBaseUrl;
  }

  private getHeaders(includeAuth: boolean = false): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (includeAuth) {
      const token = this.authService.getToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  /**
   * @deprecated Use AuthService.setToken() instead
   */
  setAuthToken(token: string): void {
    this.authService.setToken(token);
  }

  /**
   * @deprecated Use AuthService.clearToken() instead
   */
  clearAuthToken(): void {
    this.authService.clearToken();
  }

  // Generic HTTP methods
  get<T>(path: string, authenticated: boolean = false): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(authenticated),
    });
  }

  post<T>(path: string, body: any, authenticated: boolean = false): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.getHeaders(authenticated),
    });
  }

  put<T>(path: string, body: any, authenticated: boolean = false): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.getHeaders(authenticated),
    });
  }

  delete<T>(path: string, authenticated: boolean = false): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(authenticated),
    });
  }

  // Auth endpoints
  requestLogin(email: string): Observable<{ message: string }> {
    return this.post('/auth/request', { email });
  }

  verifyToken(token: string): Observable<{ message: string; token: string; user: any }> {
    return this.get(`/auth/verify?token=${token}`);
  }

  // PIT endpoints
  listPits(): Observable<any[]> {
    return this.get('/pits', true);
  }

  getPit(id: string): Observable<any> {
    return this.get(`/pits/${id}`, true);
  }

  createPit(pit: { title: string }): Observable<any> {
    return this.post('/pits', pit, true);
  }

  // Submission endpoints
  requestUpload(pitId: string): Observable<{ uploadUrl: string; fileKey: string }> {
    return this.post('/submissions/request-upload', { pitId }, true);
  }

  confirmSubmission(pitId: string, fileKey: string): Observable<{ status: string; submissionId: string }> {
    return this.post('/submissions/confirm', { pitId, fileKey }, true);
  }

  getSubmission(id: string): Observable<any> {
    return this.get(`/submissions/feedback/${id}`, true);
  }

  listMySubmissions(): Observable<any[]> {
    return this.get('/submissions/mine', true);
  }

  deleteSubmission(id: string): Observable<{ status: string }> {
    return this.delete(`/submissions/${id}`, true);
  }

  // Health check
  healthCheck(): Observable<{ status: string }> {
    return this.get('/health');
  }
}

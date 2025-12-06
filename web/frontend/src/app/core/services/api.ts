import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG, AppConfig } from '../../config/app-config';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly config: AppConfig = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.config.apiBaseUrl;
  }

  private getHeaders(includeAuth: boolean = false): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (includeAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  setAuthToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  clearAuthToken(): void {
    localStorage.removeItem('authToken');
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
    return this.get(`/submissions/${id}`, true);
  }

  listMySubmissions(): Observable<any[]> {
    return this.get('/submissions/mine', true);
  }

  // Health check
  healthCheck(): Observable<{ status: string }> {
    return this.get('/health');
  }
}

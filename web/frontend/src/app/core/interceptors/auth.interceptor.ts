import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Auth Interceptor
 *
 * Automatically attaches the JWT token to outgoing HTTP requests
 * if a token is present.
 *
 * This interceptor adds an Authorization header with the Bearer token
 * to all API requests.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Get the auth token from AuthService
  const authToken = authService.getToken();

  // If no token, proceed with the original request
  if (!authToken) {
    return next(req);
  }

  // Clone the request and add the Authorization header
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  // Pass the cloned request with the updated header to the next handler
  return next(authReq);
};

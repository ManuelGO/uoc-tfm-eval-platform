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
 * to all API requests, EXCEPT for S3 presigned URLs.
 * S3 presigned URLs already contain authentication in the URL parameters
 * and adding an Authorization header will cause the signature to fail.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Get the auth token from AuthService
  const authToken = authService.getToken();

  // If no token, proceed with the original request
  if (!authToken) {
    return next(req);
  }

  // Check if this is a request to AWS S3 (presigned URL)
  // S3 URLs contain '.amazonaws.com' or 's3.' in their domain
  const isS3Request = req.url.includes('.amazonaws.com') || req.url.includes('s3.');

  // Don't add Authorization header for S3 presigned URLs
  if (isS3Request) {
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

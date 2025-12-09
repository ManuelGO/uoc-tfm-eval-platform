import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Error Interceptor
 *
 * Intercepts HTTP errors and handles them globally:
 * - 401: Redirect to login
 * - 403: Show forbidden message
 * - Other errors: Display user-friendly messages
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        errorMessage = getServerErrorMessage(error);

        // Handle authentication errors
        if (error.status === 401) {
          // Clear auth data
          authService.logout();

          // Redirect to login with return URL
          const currentUrl = router.url;
          router.navigate(['/auth/login'], {
            queryParams: { returnUrl: currentUrl }
          });

          snackBar.open('Session expired. Please log in again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });

          return throwError(() => error);
        }

        // Handle forbidden errors
        if (error.status === 403) {
          snackBar.open('You do not have permission to perform this action.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });

          return throwError(() => error);
        }
      }

      // Log error for debugging
      console.error('HTTP Error:', {
        status: error.status,
        message: errorMessage,
        url: error.url,
        error: error.error,
      });

      // For other errors, let components handle them or show a generic message
      return throwError(() => error);
    })
  );
};

function getServerErrorMessage(error: HttpErrorResponse): string {
  // Try to get message from backend
  if (error.error?.message) {
    return error.error.message;
  }

  // Default messages based on status code
  switch (error.status) {
    case 0:
      return 'Unable to connect to the server';
    case 400:
      return 'Bad request';
    case 404:
      return 'Resource not found';
    case 500:
      return 'Internal server error';
    case 503:
      return 'Service temporarily unavailable';
    default:
      return `Server error (${error.status})`;
  }
}

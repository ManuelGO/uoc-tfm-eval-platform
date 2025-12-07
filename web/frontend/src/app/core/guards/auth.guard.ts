import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard
 *
 * Protects routes that require authentication.
 * Redirects to /auth/login if no valid JWT token is present.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isAuthenticated()) {
    // No valid token found - redirect to login
    router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  // Valid token exists - allow access
  return true;
};

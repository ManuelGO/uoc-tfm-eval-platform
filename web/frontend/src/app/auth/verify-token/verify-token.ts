import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { tap, catchError, delay, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { Api } from '../../core/services/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify-token',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './verify-token.html',
  styleUrl: './verify-token.scss',
})
export class VerifyToken implements OnInit {
  private readonly api = inject(Api);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  verifying = signal(true);
  success = signal(false);
  error = signal<string | null>(null);
  userEmail = signal<string>('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.verifying.set(false);
      this.error.set('No token provided in the URL.');
      return;
    }

    this.verifyToken(token);
  }

  private verifyToken(token: string): void {
    this.api.verifyToken(token)
      .pipe(
        tap((response) => {
          // Store JWT token using AuthService
          this.authService.setToken(response.token);

          // Store user info using AuthService
          if (response.user) {
            this.authService.setUser(response.user);
            this.userEmail.set(response.user.email || '');
          }

          this.success.set(true);
        }),
        delay(2000),
        tap(() => {
          // Get returnUrl from AuthService or default to /home
          const returnUrl = this.authService.getReturnUrl() || '/home';

          // Clear the returnUrl after using it
          this.authService.clearReturnUrl();

          // Navigate to the appropriate page
          this.router.navigate([returnUrl]);
        }),
        catchError((err) => {
          const message = err.error?.message || 'The login link is invalid or has expired.';
          this.error.set(message);
          return EMPTY;
        }),
        finalize(() => this.verifying.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}

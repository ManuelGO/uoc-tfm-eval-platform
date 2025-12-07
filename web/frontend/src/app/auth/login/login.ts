import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { Api } from '../../core/services/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  private readonly api = inject(Api);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = signal(false);
  emailSent = signal(false);

  ngOnInit(): void {
    // Save returnUrl from query params if present
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      this.authService.setReturnUrl(returnUrl);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.loading()) {
      return;
    }

    const { email } = this.loginForm.getRawValue();
    this.loading.set(true);

    this.api.requestLogin(email)
      .pipe(
        tap(() => {
          this.emailSent.set(true);
          this.snackBar.open(
            'Magic link sent! Check your email inbox.',
            'Close',
            { duration: 5000 }
          );
        }),
        catchError((error) => {
          const message = error.error?.message || 'Failed to send magic link. Please try again.';
          this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  get emailControl() {
    return this.loginForm.controls.email;
  }

  getEmailErrorMessage(): string {
    if (this.emailControl.hasError('required')) {
      return 'Email is required';
    }
    if (this.emailControl.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }
}

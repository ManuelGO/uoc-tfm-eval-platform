import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { Api } from '../../core/services/api';
import { AuthService, User } from '../../core/services/auth.service';

interface Pit {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
}

interface Submission {
  id: string;
  pitId: string;
  pitTitle?: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
  score?: number;
  submittedAt: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly api = inject(Api);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  user = signal<User | null>(null);
  pits = signal<Pit[]>([]);
  submissions = signal<Submission[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  submissionsColumns: string[] = ['pit', 'status', 'score', 'submittedAt', 'actions'];

  ngOnInit(): void {
    this.loadUserData();
    this.loadDashboardData();
  }

  private loadUserData(): void {
    const currentUser = this.authService.getUser();
    this.user.set(currentUser);
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      pits: this.api.listPits().pipe(
        catchError((err) => {
          console.error('Error loading PITs:', err);
          return of([]);
        })
      ),
      submissions: this.api.listMySubmissions().pipe(
        catchError((err) => {
          console.error('Error loading submissions:', err);
          return of([]);
        })
      ),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.pits.set(data.pits);
          this.submissions.set(data.submissions);
        },
        error: (err) => {
          this.error.set('Failed to load dashboard data. Please try again.');
          console.error('Dashboard load error:', err);
        },
      });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'DONE':
        return 'primary';
      case 'RUNNING':
        return 'accent';
      case 'ERROR':
        return 'warn';
      case 'PENDING':
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'DONE':
        return 'check_circle';
      case 'RUNNING':
        return 'hourglass_empty';
      case 'ERROR':
        return 'error';
      case 'PENDING':
      default:
        return 'schedule';
    }
  }

  retry(): void {
    this.loadDashboardData();
  }
}

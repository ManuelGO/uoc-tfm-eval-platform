import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, switchMap, takeWhile } from 'rxjs/operators';
import { of, interval } from 'rxjs';
import { Api } from '../../core/services/api';

interface ExecutionFeedback {
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  details?: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

interface Submission {
  submissionId: string;
  pitId: string;
  pitTitle?: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
  score?: number | null;
  createdAt: string;
  updatedAt: string;
  logsS3Key?: string;
  feedback?: ExecutionFeedback;
}

@Component({
  selector: 'app-status',
  imports: [
    RouterLink,
    DatePipe,
    NgClass,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './status.html',
  styleUrl: './status.scss',
})
export class Status implements OnInit {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  submission = signal<Submission | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  autoRefreshing = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSubmission(id);
    }
  }

  private loadSubmission(id: string, enableAutoRefresh = true): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getSubmission(id)
      .pipe(
        catchError((err) => {
          console.error('Error loading submission:', err);
          this.error.set('Failed to load submission. Please try again.');
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((submission) => {
        if (submission) {
          this.submission.set(submission);

          // Auto-refresh if status is PENDING or RUNNING
          if (enableAutoRefresh && (submission.status === 'PENDING' || submission.status === 'RUNNING')) {
            this.startAutoRefresh(id);
          }
        }
      });
  }

  private startAutoRefresh(id: string): void {
    if (this.autoRefreshing()) {
      return; // Already refreshing
    }

    this.autoRefreshing.set(true);

    // Poll every 5 seconds
    interval(5000)
      .pipe(
        switchMap(() => this.api.getSubmission(id)),
        takeWhile((submission: any) => {
          // Stop polling when status is DONE or ERROR
          return submission.status === 'PENDING' || submission.status === 'RUNNING';
        }, true), // true = include the final value
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((submission: any) => {
        this.submission.set(submission);

        // Stop auto-refresh when status is DONE or ERROR
        if (submission.status === 'DONE' || submission.status === 'ERROR') {
          this.autoRefreshing.set(false);
        }
      });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSubmission(id);
    }
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

  getScoreColor(score: number | null | undefined): string {
    if (score === undefined || score === null) return '';
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
}

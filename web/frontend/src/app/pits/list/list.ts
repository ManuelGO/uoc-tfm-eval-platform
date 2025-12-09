import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { Api } from '../../core/services/api';

interface Pit {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-list',
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List implements OnInit {
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);

  pits = signal<Pit[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPits();
  }

  private loadPits(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.listPits()
      .pipe(
        catchError((err) => {
          console.error('Error loading PITs:', err);
          this.error.set('Failed to load PITs. Please try again.');
          return of([]);
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((pits) => {
        this.pits.set(pits);
      });
  }

  retry(): void {
    this.loadPits();
  }
}

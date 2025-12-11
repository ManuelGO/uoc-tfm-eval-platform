import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { Api, Pit } from '../../core/services/api';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-list',
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  pits = signal<Pit[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  deleting = signal<string | null>(null);

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

  createPit(): void {
    this.router.navigate(['/pits/create']);
  }

  editPit(id: string): void {
    this.router.navigate(['/pits/edit', id]);
  }

  deletePit(pit: Pit, event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete PIT',
        message: `Are you sure you want to delete "${pit.title}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed()
      .pipe(
        switchMap((confirmed) => {
          if (confirmed) {
            this.deleting.set(pit.id);
            return this.api.deletePit(pit.id).pipe(
              catchError((err) => {
                console.error('Error deleting PIT:', err);
                this.snackBar.open(
                  err.error?.message || 'Failed to delete PIT. Please try again.',
                  'Close',
                  { duration: 5000 }
                );
                return of(null);
              }),
              finalize(() => this.deleting.set(null))
            );
          }
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (result) {
          this.snackBar.open('PIT deleted successfully!', 'Close', { duration: 3000 });
          this.pits.update(pits => pits.filter(p => p.id !== pit.id));
        }
      });
  }

  isDeleting(pitId: string): boolean {
    return this.deleting() === pitId;
  }
}

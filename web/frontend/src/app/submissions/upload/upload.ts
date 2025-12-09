import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { catchError, delay, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { Api } from '../../core/services/api';

@Component({
  selector: 'app-upload',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatStepperModule,
  ],
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class Upload implements OnInit {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  pitId = signal<string>('');
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  uploadProgress = signal(0);
  currentStep = signal<'select' | 'uploading' | 'success' | 'error'>('select');
  errorMessage = signal<string | null>(null);
  submissionId = signal<string | null>(null);
  isDragging = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('pitId');
    if (id) {
      this.pitId.set(id);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndSelectFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndSelectFile(files[0]);
    }
  }

  private validateAndSelectFile(file: File): void {
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      this.snackBar.open('Please select a ZIP file', 'Close', {
        duration: 4000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      this.snackBar.open('File size must be less than 50MB', 'Close', {
        duration: 4000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    this.selectedFile.set(file);
    this.currentStep.set('select');
    this.errorMessage.set(null);
  }

  uploadFile(): void {
    // Guard: Prevent concurrent executions
    if (this.uploading()) {
      console.warn('Upload already in progress');
      return;
    }

    const file = this.selectedFile();
    const pitId = this.pitId();

    if (!file || !pitId) {
      return;
    }

    this.uploading.set(true);
    this.currentStep.set('uploading');
    this.uploadProgress.set(0);
    this.errorMessage.set(null);

    // Step 1: Request presigned URL from backend
    this.api.requestUpload(pitId)
      .pipe(
        // Step 2: Upload to S3 using presigned URL
        switchMap(({ uploadUrl, fileKey }) => {
          return this.http.put(uploadUrl, file, {
            headers: {
              'Content-Type': 'application/zip',
            },
            reportProgress: true,
            observe: 'events'
          }).pipe(
            tap((event: any) => {
              // Track upload progress
              if (event.type === HttpEventType.UploadProgress && event.total) {
                const progress = Math.round((100 * event.loaded) / event.total);
                this.uploadProgress.set(progress);
              }
            }),
            // Filter to only process the final Response event
            filter((event: any) => event.type === HttpEventType.Response),
            // After S3 upload completes successfully, return fileKey for next step
            switchMap(() => of(fileKey))
          );
        }),
        // Step 3: Confirm submission with backend
        switchMap((fileKey) => {
          return this.api.confirmSubmission(pitId, fileKey);
        }),
        catchError((err) => {
          console.error('Upload error:', err);
          const message = err.error?.message || 'Upload failed. Please try again.';
          this.errorMessage.set(message);
          this.currentStep.set('error');
          this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          return of(null);
        }),
        tap((result) => {
          if (result) {
            this.submissionId.set(result.submissionId);
            this.currentStep.set('success');
            this.snackBar.open('Submission uploaded successfully! Redirecting...', 'Close', {
              duration: 1500,
            });
          }
        }),
        delay(1000),
        finalize(() => {
          // Always reset uploading flag, even if cancelled or errored
          this.uploading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        if (result) {
          // Automatically navigate to status page after delay
          // The status page has auto-refresh polling for PENDING/RUNNING submissions
          this.viewSubmission();
        }
      });
  }

  viewSubmission(): void {
    const id = this.submissionId();
    if (id) {
      this.router.navigate(['/submissions', id, 'status']);
    }
  }

  uploadAnother(): void {
    this.selectedFile.set(null);
    this.currentStep.set('select');
    this.uploadProgress.set(0);
    this.errorMessage.set(null);
    this.submissionId.set(null);
  }

  getFileSizeFormatted(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

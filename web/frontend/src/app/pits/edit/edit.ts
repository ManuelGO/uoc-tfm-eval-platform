import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { Api, Pit } from '../../core/services/api';

@Component({
  selector: 'app-edit-pit',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './edit.html',
  styleUrl: './edit.scss',
})
export class EditPit implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);

  loading = signal(false);
  loadingPit = signal(true);
  uploadingTests = signal(false);
  setupCommands = signal<string[]>([]);
  pitId = signal<string>('');
  pit = signal<Pit | null>(null);
  selectedTestFile = signal<File | null>(null);

  pitForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(3)]],
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    testCommand: ['mvn -q test', [Validators.required]],
    maxTimeoutMs: [60000, [Validators.required, Validators.min(1000)]],
    setupCommand: [''], // Temporary field for adding setup commands
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.snackBar.open('Invalid PIT ID', 'Close', { duration: 3000 });
      this.router.navigate(['/pits']);
      return;
    }

    this.pitId.set(id);
    this.loadPit(id);
  }

  private loadPit(id: string): void {
    this.loadingPit.set(true);

    this.api.getPit(id)
      .pipe(
        catchError((err) => {
          console.error('Error loading PIT:', err);
          this.snackBar.open(
            'Failed to load PIT. Please try again.',
            'Close',
            { duration: 5000 }
          );
          this.router.navigate(['/pits']);
          return of(null);
        }),
        finalize(() => this.loadingPit.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((pit) => {
        if (pit) {
          this.pit.set(pit);
          this.pitForm.patchValue({
            code: pit.code,
            title: pit.title,
            description: pit.description || '',
            testCommand: pit.testCommand,
            maxTimeoutMs: pit.maxTimeoutMs,
          });
          if (pit.setupCommands && pit.setupCommands.length > 0) {
            this.setupCommands.set([...pit.setupCommands]);
          }
        }
      });
  }

  onSubmit(): void {
    if (this.pitForm.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    const formValue = this.pitForm.getRawValue();

    const pitData = {
      code: formValue.code,
      title: formValue.title,
      description: formValue.description || undefined,
      testCommand: formValue.testCommand,
      maxTimeoutMs: formValue.maxTimeoutMs,
      setupCommands: this.setupCommands().length > 0 ? this.setupCommands() : undefined,
    };

    this.api.updatePit(this.pitId(), pitData)
      .pipe(
        catchError((err) => {
          console.error('Error updating PIT:', err);
          this.snackBar.open(
            err.error?.message || 'Failed to update PIT. Please try again.',
            'Close',
            { duration: 5000 }
          );
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((pit) => {
        if (pit) {
          this.snackBar.open('PIT updated successfully!', 'Close', { duration: 3000 });
          this.router.navigate(['/pits']);
        }
      });
  }

  addSetupCommand(): void {
    const command = this.pitForm.controls.setupCommand.value.trim();
    if (command) {
      this.setupCommands.update(commands => [...commands, command]);
      this.pitForm.controls.setupCommand.setValue('');
    }
  }

  removeSetupCommand(index: number): void {
    this.setupCommands.update(commands => commands.filter((_, i) => i !== index));
  }

  onTestFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.name.endsWith('.zip')) {
        this.selectedTestFile.set(file);
      } else {
        this.snackBar.open('Please select a .zip file', 'Close', { duration: 3000 });
        input.value = '';
      }
    }
  }

  uploadTests(): void {
    const file = this.selectedTestFile();
    if (!file) {
      return;
    }

    this.uploadingTests.set(true);

    this.api.uploadPitTests(this.pitId(), file)
      .pipe(
        catchError((err) => {
          console.error('Error uploading tests:', err);
          this.snackBar.open(
            err.error?.message || 'Failed to upload tests. Please try again.',
            'Close',
            { duration: 5000 }
          );
          return of(null);
        }),
        finalize(() => this.uploadingTests.set(false))
      )
      .subscribe((result) => {
        if (result) {
          this.snackBar.open('Tests uploaded successfully!', 'Close', { duration: 3000 });
          // Reload PIT to get updated testsS3Key
          this.loadPit(this.pitId());
          this.selectedTestFile.set(null);
          // Reset file input
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
        }
      });
  }

  removeTestFile(): void {
    this.selectedTestFile.set(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  cancel(): void {
    this.router.navigate(['/pits']);
  }

  get codeControl() {
    return this.pitForm.controls.code;
  }

  get titleControl() {
    return this.pitForm.controls.title;
  }

  get testCommandControl() {
    return this.pitForm.controls.testCommand;
  }

  get maxTimeoutMsControl() {
    return this.pitForm.controls.maxTimeoutMs;
  }

  getCodeErrorMessage(): string {
    if (this.codeControl.hasError('required')) {
      return 'Code is required';
    }
    if (this.codeControl.hasError('minlength')) {
      return 'Code must be at least 3 characters';
    }
    return '';
  }

  getTitleErrorMessage(): string {
    if (this.titleControl.hasError('required')) {
      return 'Title is required';
    }
    if (this.titleControl.hasError('minlength')) {
      return 'Title must be at least 3 characters';
    }
    return '';
  }

  getTestCommandErrorMessage(): string {
    if (this.testCommandControl.hasError('required')) {
      return 'Test command is required';
    }
    return '';
  }

  getMaxTimeoutErrorMessage(): string {
    if (this.maxTimeoutMsControl.hasError('required')) {
      return 'Timeout is required';
    }
    if (this.maxTimeoutMsControl.hasError('min')) {
      return 'Timeout must be at least 1000ms';
    }
    return '';
  }
}

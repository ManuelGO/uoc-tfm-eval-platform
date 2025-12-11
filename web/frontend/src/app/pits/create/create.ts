import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { Api } from '../../core/services/api';

@Component({
  selector: 'app-create-pit',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './create.html',
  styleUrl: './create.scss',
})
export class CreatePit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly api = inject(Api);

  loading = signal(false);
  uploadingTests = signal(false);
  setupCommands = signal<string[]>([]);
  selectedTestFile = signal<File | null>(null);
  createdPitId = signal<string | null>(null);

  pitForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(3)]],
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    testCommand: ['mvn -q test', [Validators.required]],
    maxTimeoutMs: [60000, [Validators.required, Validators.min(1000)]],
    setupCommand: [''], // Temporary field for adding setup commands
  });

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

    this.api.createPit(pitData)
      .pipe(
        catchError((err) => {
          console.error('Error creating PIT:', err);
          this.snackBar.open(
            err.error?.message || 'Failed to create PIT. Please try again.',
            'Close',
            { duration: 5000 }
          );
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((pit) => {
        if (pit) {
          this.createdPitId.set(pit.id);

          // If tests file is selected, upload it before navigating
          if (this.selectedTestFile()) {
            this.snackBar.open('PIT created! Now uploading tests...', 'Close', { duration: 3000 });
            this.uploadTestsAfterCreate(pit.id);
          } else {
            this.snackBar.open('PIT created successfully!', 'Close', { duration: 3000 });
            this.router.navigate(['/pits']);
          }
        }
      });
  }

  uploadTestsAfterCreate(pitId: string): void {
    const file = this.selectedTestFile();
    if (!file) {
      this.router.navigate(['/pits']);
      return;
    }

    this.uploadingTests.set(true);

    this.api.uploadPitTests(pitId, file)
      .pipe(
        catchError((err) => {
          console.error('Error uploading tests:', err);
          this.snackBar.open(
            'PIT created but tests upload failed. You can upload tests later from the edit page.',
            'Close',
            { duration: 6000 }
          );
          return of(null);
        }),
        finalize(() => {
          this.uploadingTests.set(false);
          this.router.navigate(['/pits']);
        })
      )
      .subscribe((result) => {
        if (result) {
          this.snackBar.open('PIT and tests created successfully!', 'Close', { duration: 3000 });
        }
      });
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

  removeTestFile(): void {
    this.selectedTestFile.set(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
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

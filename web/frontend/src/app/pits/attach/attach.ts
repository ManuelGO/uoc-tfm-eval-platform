import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-attach',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './attach.html',
  styleUrl: './attach.scss',
})
export class Attach {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = signal(false);

  attachForm = this.fb.nonNullable.group({
    pitCode: ['', [Validators.required, Validators.minLength(3)]],
  });

  onSubmit(): void {
    if (this.attachForm.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    const { pitCode } = this.attachForm.getRawValue();

    // TODO: Call API to attach PIT when backend endpoint is available
    // For now, show a message that the feature is coming soon
    setTimeout(() => {
      this.loading.set(false);
      this.snackBar.open(
        'PIT attachment feature coming soon! For now, all available PITs are automatically accessible.',
        'Close',
        { duration: 6000 }
      );
      this.router.navigate(['/pits']);
    }, 500);
  }

  get pitCodeControl() {
    return this.attachForm.controls.pitCode;
  }

  getPitCodeErrorMessage(): string {
    if (this.pitCodeControl.hasError('required')) {
      return 'PIT code is required';
    }
    if (this.pitCodeControl.hasError('minlength')) {
      return 'PIT code must be at least 3 characters';
    }
    return '';
  }
}

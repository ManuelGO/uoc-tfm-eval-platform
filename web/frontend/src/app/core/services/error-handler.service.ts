import { Injectable, ErrorHandler, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Global Error Handler Service
 *
 * Catches all unhandled errors in the application and displays
 * user-friendly messages using Material Snackbar.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly snackBar = inject(MatSnackBar);

  handleError(error: Error | HttpErrorResponse): void {
    let message = 'An unexpected error occurred';
    let duration = 5000;

    if (error instanceof HttpErrorResponse) {
      // Server-side or network error
      message = this.getHttpErrorMessage(error);
      duration = 7000; // Longer duration for HTTP errors
    } else if (error instanceof Error) {
      // Client-side error
      message = error.message || message;
    }

    // Log to console for debugging
    console.error('Global error caught:', error);

    // Show user-friendly message
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }

  private getHttpErrorMessage(error: HttpErrorResponse): string {
    // Check if error has a custom message from the backend
    if (error.error?.message) {
      return error.error.message;
    }

    // Handle specific status codes
    switch (error.status) {
      case 0:
        return 'Unable to connect to the server. Please check your internet connection.';
      case 400:
        return 'Bad request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'Conflict. The resource you are trying to modify has been changed.';
      case 422:
        return 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Internal server error. Please try again later.';
      case 502:
        return 'Bad gateway. The server is temporarily unavailable.';
      case 503:
        return 'Service unavailable. Please try again later.';
      case 504:
        return 'Gateway timeout. The server took too long to respond.';
      default:
        return `An error occurred (${error.status}). Please try again.`;
    }
  }
}

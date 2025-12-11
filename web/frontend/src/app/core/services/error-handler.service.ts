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
    // Always log to console for debugging
    console.error('Global error caught:', error);

    // Check if this is a technical/development error that should not be shown to users
    if (this.shouldIgnoreError(error)) {
      // Log but don't show to user
      console.warn('Technical error ignored for user notification:', error);
      return;
    }

    let message = 'An unexpected error occurred';
    let duration = 5000;

    if (error instanceof HttpErrorResponse) {
      // Server-side or network error
      message = this.getHttpErrorMessage(error);
      duration = 7000; // Longer duration for HTTP errors
    } else if (error instanceof Error) {
      // Client-side error - use a generic message for production
      message = 'An unexpected error occurred. Please try again.';
    }

    // Show user-friendly message
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }

  /**
   * Determines if an error should be ignored for user notification
   * (but still logged to console for debugging)
   */
  private shouldIgnoreError(error: Error | HttpErrorResponse): boolean {
    // Don't ignore HTTP errors - these are usually relevant to the user
    if (error instanceof HttpErrorResponse) {
      return false;
    }

    if (error instanceof Error) {
      const message = error.message || '';

      // Ignore Angular internal errors (NG0100, NG0200, etc.)
      if (/^NG\d+/.test(message)) {
        return true;
      }

      // Ignore ExpressionChangedAfterItHasBeenCheckedError
      if (message.includes('ExpressionChangedAfterItHasBeenChecked')) {
        return true;
      }

      // Ignore errors from third-party scripts or extensions
      if (message.includes('Extension context invalidated')) {
        return true;
      }

      // Ignore script loading errors (often from ad blockers or extensions)
      if (message.includes('Loading chunk') || message.includes('Failed to fetch')) {
        return true;
      }

      // Ignore ResizeObserver errors (browser internal)
      if (message.includes('ResizeObserver')) {
        return true;
      }

      // Ignore null/undefined errors that are likely development issues
      if (message.includes('Cannot read property') || message.includes('Cannot read properties')) {
        return true;
      }

      // Ignore hydration errors (SSR related)
      if (message.includes('hydration')) {
        return true;
      }
    }

    return false;
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

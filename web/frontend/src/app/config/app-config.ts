import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  authExpirationMinutes: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

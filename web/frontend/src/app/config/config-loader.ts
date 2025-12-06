import { EnvironmentProviders, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { APP_CONFIG, AppConfig } from './app-config';

const store = { config: null as AppConfig | null };

export const loadConfig = async (): Promise<void> => {
  try {
    const response = await fetch('config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }
    const config = await response.json();
    store.config = config;
    console.log('✓ Configuration loaded successfully', config);
  } catch (error) {
    console.error('✗ Failed to load configuration:', error);
    throw error;
  }
};

export const provideConfigLoader = (): EnvironmentProviders => {
  return makeEnvironmentProviders([
    provideAppInitializer(loadConfig),
    {
      provide: APP_CONFIG,
      useFactory: () => {
        if (!store.config) {
          throw new Error('Configuration not loaded');
        }
        return store.config;
      },
    },
  ]);
};

# Frontend Runtime Configuration

This Angular application uses runtime configuration loaded from `public/config.json` instead of build-time environment files. This approach allows you to modify the API URL and other settings without rebuilding the application.

## Configuration File

The configuration is stored in `/public/config.json`:

```json
{
  "apiBaseUrl": "http://localhost:3000",
  "authExpirationMinutes": 15
}
```

### Configuration Properties

- **apiBaseUrl**: The base URL for the backend API (default: `http://localhost:3000`)
- **authExpirationMinutes**: JWT token expiration time in minutes (default: 15)

## How It Works

The application uses the following architecture to load configuration at runtime:

### 1. Injection Token (`app-config.ts`)

```typescript
export interface AppConfig {
  apiBaseUrl: string;
  authExpirationMinutes: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');
```

### 2. Config Loader (`config-loader.ts`)

The configuration is loaded using `provideAppInitializer` (Angular's modern replacement for `APP_INITIALIZER`). This ensures the config is loaded before the application bootstraps.

```typescript
export const provideConfigLoader = (): Provider[] => {
  const store = { config: null as AppConfig | null };

  return [
    provideAppInitializer(() => loadConfig(store)),
    {
      provide: APP_CONFIG,
      useFactory: () => store.config,
    },
  ];
};
```

### 3. API Service (`core/services/api.ts`)

The API service injects the configuration and uses it for all HTTP requests:

```typescript
export class Api {
  private readonly config: AppConfig = inject(APP_CONFIG);

  private get baseUrl(): string {
    return this.config.apiBaseUrl;
  }

  // All API calls use this.baseUrl
}
```

## Modifying Configuration

### Local Development

Edit `public/config.json` and restart the development server:

```bash
npm start
```

### Production Deployment

1. Build the application:
```bash
npm run build
```

2. After build, modify `dist/browser/config.json` to point to your production API:
```json
{
  "apiBaseUrl": "https://api.yourdomain.com",
  "authExpirationMinutes": 30
}
```

3. Deploy the `dist/browser/` folder to your hosting service.

**Important**: You can change `config.json` without rebuilding. Simply update the file and reload the application.

## Deployment to S3 + CloudFront

### Steps:

1. **Build the application**:
```bash
npm run build
```

2. **Upload to S3**:
```bash
aws s3 sync dist/browser/ s3://your-bucket-name --profile your-profile
```

3. **Update config.json with production API URL**:
```bash
# Create a production config
echo '{
  "apiBaseUrl": "https://your-api.execute-api.eu-south-2.amazonaws.com",
  "authExpirationMinutes": 30
}' > prod-config.json

# Upload to S3
aws s3 cp prod-config.json s3://your-bucket-name/config.json --profile your-profile
```

4. **Configure CloudFront**:
   - Create a CloudFront distribution pointing to your S3 bucket
   - Set the default root object to `index.html`
   - Add error pages: redirect 404/403 to `/index.html` (for client-side routing)

5. **Update API backend CORS** to allow your CloudFront domain:
```typescript
// In your NestJS backend
app.enableCors({
  origin: ['https://your-cloudfront-domain.cloudfront.net']
});
```

## Benefits of Runtime Configuration

✅ **No rebuild required** when changing API URL
✅ **Same build** can be deployed to multiple environments
✅ **Easy environment switching** for testing
✅ **Configuration can be updated** independently of code
✅ **Simpler CI/CD** pipeline

## Environment-Specific Configuration

For different environments, you can maintain separate config files:

- `config.dev.json` - Development
- `config.staging.json` - Staging
- `config.prod.json` - Production

Deploy the appropriate config based on your environment:

```bash
# Example deployment script
if [ "$ENV" = "production" ]; then
  cp config.prod.json dist/browser/config.json
elif [ "$ENV" = "staging" ]; then
  cp config.staging.json dist/browser/config.json
else
  cp config.dev.json dist/browser/config.json
fi
```

## Troubleshooting

### Configuration not loading

Check the browser console for errors. Common issues:

1. **404 on config.json**: Ensure the file is in the `public/` folder
2. **CORS errors**: Check that your API allows requests from your frontend domain
3. **Invalid JSON**: Validate your `config.json` syntax

### Application fails to start

The app will fail to start if configuration cannot be loaded. Check:

1. `public/config.json` exists and is valid JSON
2. All required properties are present (`apiBaseUrl`, `authExpirationMinutes`)
3. No network issues preventing the fetch request

## Further Reading

- [Angular Application Initializers](https://angular.dev/api/core/provideAppInitializer)
- [Dependency Injection in Angular](https://angular.dev/guide/di)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [CloudFront Distribution Setup](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-working-with.html)

# Frontend - UOC TFM Evaluation Platform

Angular application for the automatic code evaluation platform.

## Technology Stack

- **Angular**: 20.3.12 (LTS)
- **TypeScript**: 5.8.3
- **RxJS**: 7.8.2
- **Build Tool**: Angular Build (esbuild-based)
- **Testing**: Vitest 3.2.4
- **Change Detection**: Zoneless (no Zone.js dependency)

## Features

✅ **Runtime Configuration** - No rebuild needed when changing API URL
✅ **Lazy Loading Routes** - Optimized bundle sizes
✅ **Standalone Components** - Modern Angular architecture
✅ **Zoneless Change Detection** - Better performance without Zone.js
✅ **Type-Safe API Client** - Full TypeScript support
✅ **JWT Authentication** - Secure token management

## Project Structure

```
src/
├── app/
│   ├── auth/              # Authentication components
│   │   ├── login/
│   │   └── verify-token/
│   ├── dashboard/         # Student dashboard
│   │   └── home/
│   ├── submissions/       # Submission management
│   │   ├── upload/
│   │   └── status/
│   ├── pits/              # PIT (assignment) management
│   │   ├── attach/
│   │   └── list/
│   ├── core/
│   │   ├── components/    # Shared components (navbar, loading)
│   │   └── services/      # API service
│   ├── config/            # Runtime configuration system
│   │   ├── app-config.ts
│   │   └── config-loader.ts
│   ├── app.config.ts      # Application providers
│   └── app.routes.ts      # Route definitions
└── public/
    └── config.json        # Runtime configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 22.x)
- npm 10+

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
```

Navigate to `http://localhost:4200/`

The application will automatically reload when you make changes to the source code.

### Build

```bash
npm run build
```

Build artifacts will be stored in `dist/frontend/browser/`

### Running Tests

```bash
npm test
```

## Configuration

This application uses **runtime configuration** instead of build-time environment files.

See [CONFIG.md](./CONFIG.md) for detailed information about:
- How to modify the configuration
- Deployment to S3 + CloudFront
- Environment-specific configurations

### Quick Configuration Change

Edit `public/config.json`:

```json
{
  "apiBaseUrl": "http://localhost:3000",
  "authExpirationMinutes": 15
}
```

No rebuild required! Just reload the browser.

## Available Routes

- `/auth/login` - Email login
- `/auth/verify` - Token verification (from email link)
- `/home` - Student dashboard
- `/pits` - List available PITs (assignments)
- `/pits/attach` - Attach a new PIT
- `/submissions/upload/:pitId` - Upload submission
- `/submissions/:id/status` - View submission status

## API Integration

The application connects to the NestJS backend API. The base URL is configured in `public/config.json`.

### API Client

The `Api` service (`src/app/core/services/api.ts`) provides methods for all backend endpoints:

```typescript
// Authentication
api.requestLogin(email)
api.verifyToken(token)

// PITs
api.listPits()
api.getPit(id)
api.createPit(data)

// Submissions
api.requestUpload(pitId)
api.confirmSubmission(pitId, fileKey)
api.getSubmission(id)
```

## Deployment

### Production Build

```bash
npm run build
```

### Deploy to S3

```bash
# Sync build to S3
aws s3 sync dist/frontend/browser/ s3://your-bucket-name

# Update config.json with production API
echo '{
  "apiBaseUrl": "https://your-api-domain.com",
  "authExpirationMinutes": 30
}' > prod-config.json

aws s3 cp prod-config.json s3://your-bucket-name/config.json
```

### CloudFront Setup

1. Create a CloudFront distribution pointing to your S3 bucket
2. Set default root object to `index.html`
3. Add custom error response: redirect 404 → `/index.html` (for client-side routing)

## Code Style

This project uses Prettier with the following configuration:

- Print width: 100 characters
- Single quotes
- Angular HTML parser for templates

Format code with:

```bash
npx prettier --write .
```

## Further Help

- [Angular Documentation](https://angular.dev)
- [Angular CLI Overview](https://angular.dev/tools/cli)
- [Backend API Documentation](../../api/README.md)
- [Configuration Guide](./CONFIG.md)

## License

This project is part of a Master's Final Project (TFM) for UOC.

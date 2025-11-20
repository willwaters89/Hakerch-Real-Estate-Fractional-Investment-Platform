# Hakerch Real Estate Fractional Investment Platform

A modern web platform that enables users to buy, sell, and monitor fractional shares of real estate properties.

## Project Structure

```
.
├── client/          # React PWA (Vite)
├── api/             # Express API
├── supabase/        # Database migrations and seeds
│   ├── migrations/  # SQL migration files
│   └── seeds/       # Seed data
└── docs/            # Project documentation
    ├── prd.md       # Product Requirements Document
    ├── api/         # OpenAPI/Swagger specs
    └── deployment/  # Deployment guides
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Supabase account (for authentication and database)

### Development Setup

1. Clone the repository
2. Set up environment variables (see `.env.example` in each directory)
3. Install dependencies:
   ```bash
   # Install API dependencies
   cd api
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

## Available Scripts

### Client (React PWA)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### API (Express)
- `npm run dev` - Start development server with hot-reload
- `npm start` - Start production server
- `npm test` - Run tests

## Deployment

See `docs/deployment/` for deployment guides to various platforms.

## Contributing

1. Create a new branch for your feature
2. Commit your changes
3. Push to the branch
4. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

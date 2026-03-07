# Production Deployment Guide

This guide is for contributors deploying Tynys AI to production environments.

## Prerequisites

- PostgreSQL database instance (cloud or self-hosted)
- Node.js 20+ installed
- Docker (for containerized deployment)
- Database credentials and access

## Environment Setup

### 1. Create Production Environment File

```bash
cp .env.production.example .env.production
```

### 2. Configure Database Connection

Edit `.env.production` and set your database credentials:

```dotenv
# Use your actual production database host, username, and password
DB_URL=postgresql://username:password@production-db-host:5432/database_name
DATABASE_URL=postgresql://username:password@production-db-host:5432/database_name
```

### 3. Generate Secure Secrets

```bash
# Generate a secure NEXTAUTH_SECRET
openssl rand -base64 32

# Generate a secure IOT_DEVICE_SECRET
openssl rand -base64 32
```

Update `.env.production` with these generated values:

```dotenv
NEXTAUTH_SECRET=<generated_value_here>
IOT_DEVICE_SECRET=<generated_value_here>
```

### 4. Set Production URL

```dotenv
# Use your production domain
NEXTAUTH_URL=https://yourdomain.com
```

## Database Setup

### Running Migrations

```bash
# Push schema changes to production database
npx drizzle-kit push
```

### Loading Seeded Data (Optional)

If you have seeded data from development:

```bash
# Check the seed script for current data
npm run seed
```

## Deployment Options

### GitHub Actions Production Deploy (Approval Required)

Production deploy runs from `.github/workflows/deploy.yml` on pushes to `main`, but the `production` environment must be approved in GitHub before the deploy job starts.

Required GitHub secrets:

```dotenv
SSH_HOST=<server-host>
SSH_USER=<server-user>
SSH_KEY=<private-key>
SSH_PORT=<optional, default is 22>
POSTGRES_PASSWORD=<strong-password>
NEXTAUTH_SECRET=<32+ chars>
IOT_DEVICE_SECRET=<strong-secret>
NEXTAUTH_URL=<https://your-domain>
```

Deploy behavior:

- Lint/type-check and build run first.
- Production deploy is paused until approval.
- Remote deploy writes `.env`, rebuilds containers, runs migrations, and checks app health.
- If migration or health check fails, workflow auto-rolls back to the previous commit.

Monitor deployment:

```bash
gh run list --workflow deploy.yml --limit 5
gh run watch <run-id>
gh run view <run-id> --log
```

Server-side checks:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 app
curl -i http://127.0.0.1:3010/
```

### Option 1: Docker Compose (Recommended)

The easiest way to deploy with Docker Compose, which handles both the app and database:

```bash
# Copy the docker environment example
cp .env.docker.example .env

# Edit .env with your secrets
nano .env  # or use your preferred editor

# Generate secure secrets
openssl rand -base64 32  # Use for NEXTAUTH_SECRET
openssl rand -base64 32  # Use for IOT_DEVICE_SECRET

# Start the services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop services
docker-compose down
```

The compose file includes:
- PostgreSQL database (port 5432)
- Next.js application (port 3000)
- Automatic healthchecks
- Persistent database volume

### Option 2: Docker Build & Run Manually

```bash
# Build the production Docker image
./scripts/build_prod_image.sh

# Run the container
docker run -d \
  -e DB_URL="postgresql://user:pass@host:5432/db" \
  -e NEXTAUTH_SECRET="<your_secret>" \
  -e IOT_DEVICE_SECRET="<your_secret>" \
  -p 3000:3000 \
  tynys-ai:latest
```

### Option 3: Traditional Deployment

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start the application
NODE_ENV=production node .next/standalone/server.js
```

## Security Checklist

- [ ] `.env.production` is NOT committed to git
- [ ] All secrets are randomly generated (not defaults)
- [ ] Database credentials are strong
- [ ] NEXTAUTH_URL matches your production domain
- [ ] Database user has minimum required permissions
- [ ] HTTPS is enabled for production domain
- [ ] IOT_DEVICE_SECRET is shared securely with IoT devices

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql postgresql://user:password@host:5432/database_name
```

### Build Failures

```bash
# Clear build cache and rebuild
rm -rf .next
npm run build
```

### Runtime Errors

Check logs:
```bash
# If running in Docker
docker logs <container_id>

# If running directly
NODE_ENV=production npm run dev
```

## Database Backup & Recovery

```bash
# Backup production database
pg_dump postgresql://user:password@host:5432/database_name > backup.sql

# Restore from backup
psql postgresql://user:password@host:5432/database_name < backup.sql
```

## Support

For issues or questions:
1. Check [CONTRIBUTING.md](CONTRIBUTING.md)
2. Review [Database Schema Documentation](docs/database-schema.md)
3. Open an issue on GitHub with detailed error logs

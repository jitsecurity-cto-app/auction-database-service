# Auction Database Service

Node.js/Express REST API service providing data access for the Vulnerable Auction Lab platform.

## Overview

This service provides the backend API for both the customer-facing application and the CRM/admin application. It handles auctions, bids, orders, users, and disputes.

## Quick Start

```bash
npm install
npm run dev
```

## Documentation

**All documentation has been moved to the centralized documentation repository:**

👉 **[View Full Documentation](https://github.com/jitsecurity-cto-app/auction-app-docs)**

The documentation repository contains:
- Complete setup and deployment guides
- API documentation
- Security vulnerability documentation
- Architecture and design decisions
- Service-specific guides

## Service-Specific Documentation

- [Service README](https://github.com/jitsecurity-cto-app/auction-app-docs/blob/main/services/database-service/README.md)
- [Security Vulnerabilities](https://github.com/jitsecurity-cto-app/auction-app-docs/blob/main/services/database-service/SECURITY.md)
- [Lambda Deployment Guide](https://github.com/jitsecurity-cto-app/auction-app-docs/blob/main/services/database-service/LAMBDA_GUIDE.md)

## Tech Stack

- Node.js 18+
- Express
- TypeScript
- PostgreSQL (via RDS)
- AWS Lambda + API Gateway (deployment)

## Important Notes

⚠️ **This lab intentionally contains security vulnerabilities for educational purposes. Never deploy to production without proper security hardening.**

## License

Educational use only. Not for production deployment.

# Security Vulnerabilities - Database Service

This service intentionally contains security vulnerabilities for educational purposes.

## Vulnerabilities

1. **SQL Injection** - All database queries use string concatenation
2. **Weak JWT** - Weak secret, no expiration
3. **Missing Authorization** - No permission checks
4. **IDOR** - Direct object references
5. **No Input Validation** - Accepts any input
6. **CORS Misconfiguration** - Allows all origins
7. **Sensitive Data Logging** - Logs passwords and tokens

See main `SECURITY.md` for details.

**⚠️ Never deploy to production without fixing these vulnerabilities.**


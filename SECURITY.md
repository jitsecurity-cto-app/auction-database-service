# Security Vulnerabilities - Database Service

This service intentionally contains security vulnerabilities for educational purposes.

## Vulnerabilities

1. **SQL Injection** - All database queries use string concatenation
   - Order filters vulnerable: `buyer_id`, `seller_id`, `status`, `payment_status`, `shipping_status`
   - Auction closure queries use string concatenation
2. **Weak JWT** - Weak secret, no expiration
3. **Missing Authorization** - No permission checks
   - Anyone can close any auction
   - Anyone can access/update any order
4. **IDOR** - Direct object references
   - Order access by ID without authorization
   - Can access orders for any user
5. **No Input Validation** - Accepts any input
   - Shipping addresses not validated
   - Tracking numbers not validated
6. **CORS Misconfiguration** - Allows all origins
7. **Sensitive Data Logging** - Logs passwords and tokens
8. **Race Conditions** - Auction closure and winner determination not atomic

See main `SECURITY.md` for details.

**⚠️ Never deploy to production without fixing these vulnerabilities.**


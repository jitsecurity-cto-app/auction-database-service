import { describe, it, expect } from '@jest/globals';

describe('Environment Config', () => {
  it('should include optional Stripe, Sentry, and LaunchDarkly env vars in config interface', async () => {
    // Set required vars
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    process.env.SENTRY_DSN = 'https://test@sentry.io/123';
    process.env.LAUNCHDARKLY_SDK_KEY = 'sdk-test-123';

    // Re-import to pick up new env vars
    jest.resetModules();
    const { env } = await import('../../src/config/env');

    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_123');
    expect(env.STRIPE_WEBHOOK_SECRET).toBe('whsec_test_123');
    expect(env.SENTRY_DSN).toBe('https://test@sentry.io/123');
    expect(env.LAUNCHDARKLY_SDK_KEY).toBe('sdk-test-123');
  });
});

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockInit = jest.fn<any>();
const mockVariation = jest.fn<any>();
const mockClose = jest.fn<any>();
const mockWaitForInitialization = jest.fn<any>();

jest.mock('@launchdarkly/node-server-sdk', () => ({
  init: jest.fn<any>().mockReturnValue({
    waitForInitialization: mockWaitForInitialization,
    variation: mockVariation,
    close: mockClose,
  }),
}));

jest.mock('../../src/config/env', () => ({
  env: { LAUNCHDARKLY_SDK_KEY: 'sdk-test-123' },
}));

import { initFeatureFlags, getFlag, closeFeatureFlags } from '../../src/lib/featureFlags';

describe('Feature Flags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize LaunchDarkly client', async () => {
    mockWaitForInitialization.mockResolvedValueOnce(undefined);
    await initFeatureFlags();
    const ld = require('@launchdarkly/node-server-sdk');
    expect(ld.init).toHaveBeenCalledWith('sdk-test-123');
  });

  it('should evaluate a flag', async () => {
    mockWaitForInitialization.mockResolvedValueOnce(undefined);
    await initFeatureFlags();

    mockVariation.mockResolvedValueOnce(true);

    const result = await getFlag('test-flag', { key: 'user-1' }, false);
    expect(result).toBe(true);
    expect(mockVariation).toHaveBeenCalledWith('test-flag', { key: 'user-1' }, false);
  });

  it('should return default when client not initialized', async () => {
    // Don't initialize — reset module to get fresh state
    jest.resetModules();

    // Re-mock
    jest.mock('@launchdarkly/node-server-sdk', () => ({
      init: jest.fn<any>().mockReturnValue({
        waitForInitialization: jest.fn<any>(),
        variation: jest.fn<any>(),
        close: jest.fn<any>(),
      }),
    }));
    jest.mock('../../src/config/env', () => ({
      env: {},
    }));

    const freshModule = await import('../../src/lib/featureFlags');
    const result = await freshModule.getFlag('test-flag', { key: 'user-1' }, false);
    expect(result).toBe(false);
  });
});

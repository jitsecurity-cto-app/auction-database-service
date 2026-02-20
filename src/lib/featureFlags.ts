import * as LaunchDarkly from '@launchdarkly/node-server-sdk';
import { env } from '../config/env';

let ldClient: LaunchDarkly.LDClient | null = null;

export async function initFeatureFlags(): Promise<void> {
  if (!env.LAUNCHDARKLY_SDK_KEY) {
    console.log('LaunchDarkly SDK key not set, feature flags disabled');
    return;
  }

  ldClient = LaunchDarkly.init(env.LAUNCHDARKLY_SDK_KEY);
  await ldClient.waitForInitialization();
  console.log('LaunchDarkly client initialized');
}

export async function getFlag(
  flagKey: string,
  context: LaunchDarkly.LDContext,
  defaultValue: boolean
): Promise<boolean> {
  if (!ldClient) {
    return defaultValue;
  }

  return ldClient.variation(flagKey, context, defaultValue);
}

export async function closeFeatureFlags(): Promise<void> {
  if (ldClient) {
    await ldClient.close();
    ldClient = null;
  }
}

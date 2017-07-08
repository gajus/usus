// @flow

import test from 'ava';
import createConfiguration, {
  deviceMetricsOverrideDesktopProfile
} from '../src/factories/createConfiguration';

const createDefaultConfiguration = () => {
  return {
    delay: 5000,
    deviceMetricsOverride: {
      ...deviceMetricsOverrideDesktopProfile
    },
    inlineStyles: false
  };
};

test('creates default configuration', (t) => {
  const configuration = createConfiguration({});

  const defaultConfiguration = createDefaultConfiguration();

  t.deepEqual(configuration, defaultConfiguration);
});

test('overrides delay', (t) => {
  const configuration = createConfiguration({
    delay: 1000
  });

  const defaultConfiguration = createDefaultConfiguration();

  defaultConfiguration.delay = 1000;

  t.deepEqual(configuration, defaultConfiguration);
});

test('deviceMetricsOverride.height = 100', (t) => {
  const configuration = createConfiguration({
    deviceMetricsOverride: {
      height: 100
    }
  });

  const defaultConfiguration = createDefaultConfiguration();

  defaultConfiguration.deviceMetricsOverride = {
    ...deviceMetricsOverrideDesktopProfile,
    height: 100
  };

  t.deepEqual(configuration, defaultConfiguration);
});

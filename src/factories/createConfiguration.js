// @flow

import type {
  ConfigurationType,
  UserConfigurationType
} from '../types';

// 1080x1920 is the 2nd most popular desktop device resolution
// @see https://www.w3counter.com/globalstats.php
export const deviceMetricsOverrideDesktopProfile = {
  deviceScaleFactor: 1,
  fitWindow: false,
  height: 1080,
  mobile: false,
  width: 1920
};

export default (userConfiguration: UserConfigurationType): ConfigurationType => {
  const delayConfiguration = userConfiguration.delay || 5000;
  const inlineStyles = userConfiguration.inlineStyles || false;
  const cookies = userConfiguration.cookies || [];

  let deviceMetricsOverride = deviceMetricsOverrideDesktopProfile;

  if (userConfiguration.deviceMetricsOverride) {
    deviceMetricsOverride = {
      ...deviceMetricsOverride,
      ...userConfiguration.deviceMetricsOverride
    };
  }

  return {
    cookies,
    delay: delayConfiguration,
    deviceMetricsOverride,
    inlineStyles
  };
};

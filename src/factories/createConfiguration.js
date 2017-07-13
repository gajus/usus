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
  const chromePort = userConfiguration.chromePort;
  const cookies = userConfiguration.cookies || [];
  const delayConfiguration = userConfiguration.delay || 5000;
  const extractStyles = userConfiguration.extractStyles || false;
  const formatStyles = userConfiguration.formatStyles;
  const inlineStyles = userConfiguration.inlineStyles || false;
  const preloadFonts = userConfiguration.preloadFonts !== false;
  const preloadStyles = userConfiguration.preloadStyles !== false;

  if (extractStyles && inlineStyles) {
    throw new Error('inlineStyles and inlineStyles options cannot be used together.');
  }

  let deviceMetricsOverride = deviceMetricsOverrideDesktopProfile;

  if (userConfiguration.deviceMetricsOverride) {
    deviceMetricsOverride = {
      ...deviceMetricsOverride,
      ...userConfiguration.deviceMetricsOverride
    };
  }

  return {
    chromePort,
    cookies,
    delay: delayConfiguration,
    deviceMetricsOverride,
    extractStyles,
    formatStyles,
    inlineStyles,
    preloadFonts,
    preloadStyles
  };
};

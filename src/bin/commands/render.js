#!/usr/bin/env node

// @flow

import {
  render
} from '../../usus';

export const command = 'render';
export const desc = 'Renders page using Chrome Debugging Protocol. Extracts CSS used to render the page. Renders HTML with the blocking CSS made asynchronous. Inlines the critical CSS.';

export const baseConfiguration = {
  cookies: {
    description: 'Sets a cookie with the given cookie data. Must be provided as key=value pairs, e.g. foo=bar.',
    type: 'array'
  },
  delay: {
    default: 5000,
    description: 'Defines how many milliseconds to wait after the "load" event has been fired before capturing the styles used to load the page. This is important if resources appearing on the page are being loaded asynchronously.'
  },
  'deviceMetricsOverride.deviceScaleFactor': {
    default: 1,
    description: 'Overriding device scale factor value.',
    type: 'number'
  },
  'deviceMetricsOverride.fitWindow': {
    default: false,
    description: 'Whether a view that exceeds the available browser window area should be scaled down to fit.',
    type: 'boolean'
  },
  'deviceMetricsOverride.height': {
    default: 1080,
    description: 'Overriding width value in pixels (minimum 0, maximum 10000000).',
    type: 'number'
  },
  'deviceMetricsOverride.mobile': {
    default: false,
    description: 'Whether to emulate mobile device. This includes viewport meta tag, overlay scrollbars, text autosizing and more.',
    type: 'boolean'
  },
  'deviceMetricsOverride.width': {
    default: 1920,
    description: 'Overriding height value in pixels (minimum 0, maximum 10000000).',
    type: 'number'
  },
  extractStyles: {
    default: false,
    description: 'Extracts CSS used to render the page.',
    type: 'boolean'
  },
  inlineStyles: {
    default: false,
    description: 'Inlines the styles required to render the document.',
    type: 'boolean'
  }
};

// eslint-disable-next-line flowtype/no-weak-types
export const builder = (yargs: Object): void => {
  yargs
    .options({
      ...baseConfiguration,
      url: {
        demand: true,
        description: 'The URL to render.'
      }
    });
};

// eslint-disable-next-line flowtype/no-weak-types
export const handler = async (argv: Object) => {
  const cookies = [];

  if (argv.cookies) {
    for (const tuple of argv.cookies) {
      const [
        key,
        value
      ] = tuple.split('=', 2);

      const cookie = {
        name: key,
        value
      };

      cookies.push(cookie);
    }
  }

  const css = await render(argv.url, {
    argv,
    cookies
  });

  // eslint-disable-next-line no-console
  console.log(css);
};

// @flow

import URL from 'url';

/**
 * It is important to load to use relative URLs when the protocol and host match.
 * This is because pre-rendering might be done against a different URL than the
 * actual website, e.g. https://raw.gajus.com/ instead of https://gajus.com/.
 * Therefore, we need to ensure that resources are loaded relative to the
 * current host.
 */
export default (targetUrl: string, resourceUrl: string): string => {
  const targetUrlTokens = URL.parse(targetUrl);
  const resourceUrlTokens = URL.parse(resourceUrl);

  if (targetUrlTokens.protocol !== resourceUrlTokens.protocol || targetUrlTokens.host !== resourceUrlTokens.host) {
    return resourceUrl;
  }

  return String(resourceUrlTokens.path);
};

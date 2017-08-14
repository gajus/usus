// @flow

import URL from 'url';
import {
  launch
} from 'chrome-launcher';
import CDP from 'chrome-remote-interface';
import createDebug from 'debug';
import surgeon from 'surgeon';
import {
  delay
} from 'bluefeather';
import createConfiguration from './factories/createConfiguration';
import normalizeNetworkResourceUrl from './utilities/normalizeNetworkResourceUrl';
import type {
  UserConfigurationType
} from './types';

const debug = createDebug('usus');

export const launchChrome = (options: {chromeFlags: string[]} = {
  chromeFlags: [
    '--disable-gpu',
    '--headless'
  ]
}) => {
  return launch(options);
};

const inlineStyles = async (DOM: *, Runtime: *, rootNodeId: number, styles: string) => {
  // @todo I am sure there is a better way to do this,
  // but I cannot find it documented in the https://chromedevtools.github.io/devtools-protocol/tot/DOM/
  // e.g. How to create a new node using CDP DOM API?
  await Runtime.evaluate({
    expression: `
      {
        const styleElement = document.createElement('div');
        styleElement.setAttribute('id', 'usus-inline-styles');
        document.head.appendChild(styleElement);
      }
    `
  });

  const nodeId = (await DOM.querySelector({
    nodeId: rootNodeId,
    selector: '#usus-inline-styles'
  })).nodeId;

  debug('#usus-inline-styles nodeId %d', nodeId);

  const stylesheet = `<style>${styles}</style>`;

  await DOM.setOuterHTML({
    nodeId,
    outerHTML: stylesheet
  });
};

const inlineImports = async (DOM: *, Runtime: *, rootNodeId: number, styleImports: $ReadOnlyArray<string>) => {
  // @todo See note in inlineStyles.

  await Runtime.evaluate({
    expression: `
      {
        const scriptElement = document.createElement('div');
        scriptElement.setAttribute('id', 'usus-style-import');
        document.body.appendChild(scriptElement);
      }
    `
  });

  const nodeId = (await DOM.querySelector({
    nodeId: rootNodeId,
    selector: '#usus-style-import'
  })).nodeId;

  debug('#usus-style-import nodeId %d', nodeId);

  await DOM.setOuterHTML({
    nodeId,
    outerHTML: styleImports.join('\n')
  });
};

const inlineStylePreload = async (DOM: *, Runtime: *, rootNodeId: number, styleImports: $ReadOnlyArray<string>) => {
  // @todo See note in inlineStyles.

  await Runtime.evaluate({
    expression: `
      {
        const scriptElement = document.createElement('div');
        scriptElement.setAttribute('id', 'usus-style-preload');
        document.head.appendChild(scriptElement);
      }
    `
  });

  const nodeId = (await DOM.querySelector({
    nodeId: rootNodeId,
    selector: '#usus-style-preload'
  })).nodeId;

  debug('#usus-style-preload nodeId %d', nodeId);

  const x = surgeon();

  const styleUrls = x('select link {0,} | read attribute href', styleImports.join(''));

  const stylePreloadLinks = styleUrls
    .map((styleUrl) => {
      return `<link rel="preload" href="${styleUrl}" as="style">`;
    });

  await DOM.setOuterHTML({
    nodeId,
    outerHTML: stylePreloadLinks.join('\n')
  });
};

const inlineFontPreload = async (DOM: *, Runtime: *, rootNodeId: number, fontUrls: $ReadOnlyArray<string>) => {
  // @todo See note in inlineStyles.

  await Runtime.evaluate({
    expression: `
      {
        const scriptElement = document.createElement('div');
        scriptElement.setAttribute('id', 'usus-font-preload');
        document.head.appendChild(scriptElement);
      }
    `
  });

  const nodeId = (await DOM.querySelector({
    nodeId: rootNodeId,
    selector: '#usus-font-preload'
  })).nodeId;

  debug('#usus-font-preload nodeId %d', nodeId);

  const stylePreloadLinks = fontUrls
    .map((fontUrl) => {
      return `<link rel="preload" href="${fontUrl}" as="font">`;
    });

  await DOM.setOuterHTML({
    nodeId,
    outerHTML: stylePreloadLinks.join('\n')
  });
};

export const render = async (url: string, userConfiguration: UserConfigurationType = {}): Promise<string> => {
  const configuration = createConfiguration(userConfiguration);

  debug('rendering URL %s', JSON.stringify(configuration));

  let chrome;
  let chromePort;

  if (configuration.chromePort) {
    debug('attempting to use the user provided instance of Chrome (port %d)', configuration.chromePort);

    chromePort = configuration.chromePort;
  } else {
    chrome = await launchChrome();
    chromePort = chrome.port;
  }

  const protocol = await CDP({
    port: chromePort
  });

  const end = async (): Promise<void> => {
    await protocol.close();

    if (!chrome) {
      return;
    }

    await chrome.kill();
  };

  const {
    CSS,
    DOM,
    Emulation,
    Network,
    Page,
    Runtime
  } = protocol;

  await DOM.enable();
  await CSS.enable();
  await Page.enable();
  await Runtime.enable();
  await Network.enable();

  Emulation.setDeviceMetricsOverride(configuration.deviceMetricsOverride);

  for (const cookie of configuration.cookies) {
    Network.setCookie({
      name: cookie.name,
      url,
      value: cookie.value
    });
  }

  const inlineStylesheetIndex = [];
  const alienFrameStylesheetIndex = [];

  CSS.styleSheetAdded(({header}) => {
    // eslint-disable-next-line no-use-before-define
    const mainFrameId = frameId;

    if (!mainFrameId) {
      throw new Error('Stylesheet has been added before frameId has been established.');
    }

    if (header.frameId !== mainFrameId) {
      alienFrameStylesheetIndex.push(header.styleSheetId);
    }

    if (header.isInline) {
      inlineStylesheetIndex.push(header.styleSheetId);
    }
  });

  await CSS.startRuleUsageTracking();

  const frame = await Page.navigate({
    url
  });

  const downloadedFontUrls = [];

  Network.requestWillBeSent((request) => {
    if (request.frameId !== frame.frameId) {
      debug('ignoring HTTP request; alien frame');

      return;
    }

    const tokens = URL.parse(request.request.url);

    const pathname = tokens.pathname;

    if (!pathname) {
      debug('ignoring HTTP request; URL is missing pathname');

      return;
    }

    if (!pathname.endsWith('.woff') && !pathname.endsWith('.woff2')) {
      debug('ignoring HTTP request; network resource is not a supported font');

      return;
    }

    downloadedFontUrls.push(normalizeNetworkResourceUrl(url, tokens.href));
  });

  const frameId = frame.frameId;

  let usedStyles;

  usedStyles = await new Promise((resolve) => {
    Page.loadEventFired(async () => {
      debug('"load" event received; waiting %d milliseconds before capturing the CSS coverage report', configuration.delay);

      await delay(configuration.delay);

      debug('alien stylesheets', inlineStylesheetIndex);
      debug('inline stylesheets', inlineStylesheetIndex);

      const rules = await CSS.takeCoverageDelta();

      const usedRules = rules.coverage
        .filter((rule) => {
          return rule.used;
        });

      const slices = [];

      for (const usedRule of usedRules) {
        if (alienFrameStylesheetIndex.includes(usedRule.styleSheetId)) {
          debug('skipping alien stylesheet %d', usedRule.styleSheetId);

          // eslint-disable-next-line no-continue
          continue;
        }

        if (inlineStylesheetIndex.includes(usedRule.styleSheetId)) {
          debug('skipping inline stylesheet %d', usedRule.styleSheetId);

          // eslint-disable-next-line no-continue
          continue;
        }

        const stylesheet = await CSS.getStyleSheetText({
          styleSheetId: usedRule.styleSheetId
        });

        slices.push(stylesheet.text.slice(usedRule.startOffset, usedRule.endOffset));
      }

      resolve(slices.join(''));
    });
  });

  await CSS.stopRuleUsageTracking();

  if (configuration.formatStyles) {
    usedStyles = await configuration.formatStyles(usedStyles);
  }

  const rootDocument = await DOM.getDocument();

  if (configuration.inlineStyles) {
    const styleImportNodeIds = (await DOM.querySelectorAll({
      nodeId: rootDocument.root.nodeId,
      selector: 'head link[rel="stylesheet"]'
    })).nodeIds;

    debug('found %d style imports contained in the <head> element', styleImportNodeIds.length);

    const styleImportLinks = [];

    for (const styleImportNodeId of styleImportNodeIds) {
      const styleImportNodeHtml = await DOM.getOuterHTML({
        nodeId: styleImportNodeId
      });

      // @todo Add ability to conditionally allow certain nodes.
      debug('found CSS import; removing import from the <head> element', styleImportNodeHtml);

      await DOM.removeNode({
        nodeId: styleImportNodeId
      });

      styleImportLinks.push(styleImportNodeHtml.outerHTML);
    }

    if (configuration.preloadStyles) {
      await inlineStylePreload(DOM, Runtime, rootDocument.root.nodeId, styleImportLinks);
    }

    if (configuration.preloadFonts) {
      await inlineFontPreload(DOM, Runtime, rootDocument.root.nodeId, downloadedFontUrls);
    }

    if (usedStyles) {
      await inlineStyles(DOM, Runtime, rootDocument.root.nodeId, usedStyles);
    }

    await inlineImports(DOM, Runtime, rootDocument.root.nodeId, styleImportLinks);

    const rootOuterHTMLWithInlinedStyles = (await DOM.getOuterHTML({
      nodeId: rootDocument.root.nodeId
    })).outerHTML;

    await end();

    return rootOuterHTMLWithInlinedStyles;
  }

  if (configuration.extractStyles) {
    await end();

    // @todo Document that `extractStyles` does not return the inline stylesheets.
    // @todo Document that `extractStyles` does not return the alien stylesheets.

    return usedStyles;
  }

  const rootOuterHTML = (await DOM.getOuterHTML({
    nodeId: rootDocument.root.nodeId
  })).outerHTML;

  await end();

  return rootOuterHTML;
};

// @flow

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
import type {
  UserConfigurationType
} from './types';

const debug = createDebug('usus');

const launchChrome = () => {
  return launch({
    chromeFlags: [
      '--disable-gpu',
      '--headless'
    ]
  });
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

export const render = async (url: string, userConfiguration: UserConfigurationType = {}): Promise<string> => {
  const configuration = createConfiguration(userConfiguration);

  debug('rendering URL %s', JSON.stringify(configuration));

  const chrome = await launchChrome();

  const protocol = await CDP({
    port: chrome.port
  });

  const {
    CSS,
    DOM,
    Emulation,
    Page,
    Runtime,
    Network
  } = protocol;

  await DOM.enable();
  await CSS.enable();
  await Page.enable();
  await Runtime.enable();

  Emulation.setDeviceMetricsOverride(configuration.deviceMetricsOverride);

  for (const cookie of configuration.cookies) {
    Network.setCookie({
      name: cookie.name,
      url,
      value: cookie.value
    });
  }

  const inlineStylesheetIndex = [];

  CSS.styleSheetAdded(({header}) => {
    if (header.isInline) {
      inlineStylesheetIndex.push(header.styleSheetId);
    }
  });

  CSS.startRuleUsageTracking();

  Page.navigate({
    url
  });

  let usedStyles;

  usedStyles = await new Promise((resolve) => {
    Page.loadEventFired(async () => {
      debug('"load" event received; waiting %d milliseconds before capturing the CSS coverage report', configuration.delay);

      await delay(configuration.delay);

      debug('inline stylesheets', inlineStylesheetIndex);

      const rules = await CSS.takeCoverageDelta();

      const usedRules = rules.coverage
        .filter((rule) => {
          return rule.used;
        });

      const slices = [];

      for (const usedRule of usedRules) {
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

    if (usedStyles) {
      await inlineStyles(DOM, Runtime, rootDocument.root.nodeId, usedStyles);
    }

    await inlineImports(DOM, Runtime, rootDocument.root.nodeId, styleImportLinks);

    const rootOuterHTMLWithInlinedStyles = (await DOM.getOuterHTML({
      nodeId: rootDocument.root.nodeId
    })).outerHTML;

    await chrome.kill();

    return rootOuterHTMLWithInlinedStyles;
  }

  if (configuration.extractStyles) {
    await chrome.kill();

    // @todo Document that `extractStyles` does not return inline stylesheets.

    return usedStyles;
  }

  const rootOuterHTML = (await DOM.getOuterHTML({
    nodeId: rootDocument.root.nodeId
  })).outerHTML;

  await chrome.kill();

  return rootOuterHTML;
};

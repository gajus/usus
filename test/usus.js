// @flow

import test, {
  after,
  before
} from 'ava';
import {
  launchChrome,
  render
} from '../src/usus';
import {
  isHtmlEqual,
  serve
} from './helpers';

let chromeInstance;
let chromePort;

before(async () => {
  const chrome = await launchChrome();

  chromeInstance = chrome;
  chromePort = chrome.port;
});

after.always(async () => {
  await chromeInstance.kill();
});

test('renders HTML', async (t) => {
  const server = await serve(`
    <html>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500
  });

  await server.close();

  t.true(isHtmlEqual(result, `
    <html>
      <head></head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `));
});

test('inlines CSS (preloadStyles=false)', async (t) => {
  const styleServer = await serve(`
    body {
      background: #f00;
    }
  `, 'text/css');

  const server = await serve(`
    <html>
      <head>
        <link rel='stylesheet' href='${styleServer.url}'>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500,
    inlineStyles: true,
    preloadStyles: false
  });

  await styleServer.close();
  await server.close();

  t.true(isHtmlEqual(result, `
    <html>
      <head>
        <style>body { background: #f00; }</style>
      </head>
      <body>
        <p>Hello, World!</p>

        <link href="${styleServer.url}" rel="stylesheet">
      </body>
    </html>`
  ));
});

test('inlines CSS (preloadFonts=true)', async (t) => {
  const server = await serve(`
    <html>
      <head>
        <style>
        @import url('https://fonts.googleapis.com/css?family=Open+Sans');

        body {
          font-family: 'Open Sans', sans-serif;
        }
        </style>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500,
    inlineStyles: true
  });

  await server.close();

  t.true(isHtmlEqual(result, `
    <html>
      <head>
        <style>
        @import url('https://fonts.googleapis.com/css?family=Open+Sans');

        body {
          font-family: 'Open Sans', sans-serif;
        }
        </style>
        <link rel="preload" href="https://fonts.gstatic.com/s/opensans/v14/cJZKeOuBrn4kERxqtaUH3ZBw1xU1rKptJj_0jans920.woff2" as="font">
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>`
  ));
});

test('inlines CSS (preloadStyles=true)', async (t) => {
  const styleServer = await serve(`
    body {
      background: #f00;
    }
  `, 'text/css');

  const server = await serve(`
    <html>
      <head>
        <link rel='stylesheet' href='${styleServer.url}'>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500,
    inlineStyles: true
  });

  await styleServer.close();
  await server.close();

  t.true(isHtmlEqual(result, `
    <html>
      <head>
        <link as="style" href="${styleServer.url}" rel="preload">
        <style>body { background: #f00; }</style>
      </head>
      <body>
        <p>Hello, World!</p>

        <link href="${styleServer.url}" rel="stylesheet">
      </body>
    </html>`
  ));
});

test('extracts CSS', async (t) => {
  const styleServer = await serve(`
    body {
      background: #f00;
    }
  `, 'text/css');

  const server = await serve(`
    <html>
      <head>
        <link rel='stylesheet' href='${styleServer.url}'>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500,
    extractStyles: true
  });

  await styleServer.close();
  await server.close();

  t.true(result.replace(/\s/g, '') === 'body{background:#f00;}');
});

test('does not re-inline the inline CSS', async (t) => {
  const server = await serve(`
    <html>
      <head>
        <style>
        body {
          background: #f00;
        }
        </style>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500,
    inlineStyles: true,
    preloadStyles: false
  });

  await server.close();

  t.true(isHtmlEqual(result, `
    <html>
      <head>
        <style>
        body {
          background: #f00;
        }
        </style>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `));
});

test('does not inline CSS from alien frames', async (t) => {
  const server = await serve(`
    <html>
      <head>
        <style>
        body {
          background: #f00;
        }
        </style>
      </head>
      <body>
        <iframe width="560" height="315" src="https://www.youtube.com/embed/HEew7zvpAWE" frameborder="0" allowfullscreen></iframe>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 2000,
    inlineStyles: true,
    preloadStyles: false
  });

  await server.close();

  t.true(isHtmlEqual(result, `
    <html>
      <head>
        <style>
        body {
          background: #f00;
        }
        </style>
      </head>
      <body>
        <iframe width="560" height="315" src="https://www.youtube.com/embed/HEew7zvpAWE" frameborder="0" allowfullscreen></iframe>
      </body>
    </html>
  `));
});

test('extracts only the used CSS', async (t) => {
  const styleServer = await serve(`
    body {
      background: #f00;
    }
    .foo {
      background: #00f;
    }
  `, 'text/css');

  const server = await serve(`
    <html>
      <head>
        <link rel='stylesheet' href='${styleServer.url}'>
      </head>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
    chromePort,
    delay: 500,
    extractStyles: true
  });

  await styleServer.close();
  await server.close();

  t.true(result.replace(/\s/g, '') === 'body{background:#f00;}');
});

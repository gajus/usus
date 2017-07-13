// @flow

import test from 'ava';
import {
  render
} from '../src/usus';
import {
  isHtmlEqual,
  serve
} from './helpers';

test('renders HTML', async (t) => {
  const server = await serve(`
    <html>
      <body>
        <p>Hello, World!</p>
      </body>
    </html>
  `);

  const result = await render(server.url, {
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

test('inlines CSS', async (t) => {
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
    delay: 500,
    inlineStyles: true
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
    delay: 500,
    extractStyles: true
  });

  await styleServer.close();
  await server.close();

  t.true(result.replace(/\s/g, '') === 'body{background:#f00;}');
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
    delay: 500,
    extractStyles: true
  });

  await styleServer.close();
  await server.close();

  t.true(result.replace(/\s/g, '') === 'body{background:#f00;}');
});

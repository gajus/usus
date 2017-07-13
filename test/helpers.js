// @flow

import fastify from 'fastify';
import getPort from 'get-port';
import {
  HtmlDiffer
} from 'html-differ';
import logger from 'html-differ/lib/logger';

const htmlDiffer = new HtmlDiffer({
  ignoreComments: false,
  ignoreEndTags: true,
  ignoreWhitespaces: true
});

export const isHtmlEqual = (html1: string, html2: string) => {
  const htmlIsEqual = htmlDiffer.isEqual(html1, html2);

  if (htmlIsEqual) {
    return true;
  }

  const diff = htmlDiffer.diffHtml(html1, html2);

  const log = logger.getDiffText(diff, {
    charsAroundDiff: 40
  });

  // eslint-disable-next-line no-console
  console.log(log);

  return false;
};

export const serve = async (body: string, contentType: string = 'text/html') => {
  const freePort = await getPort();

  const app = fastify();

  app.get('/', (req, res) => {
    res
      .header('Content-Type', contentType)
      .send(body);
  });

  await app.listen(freePort);

  const url = 'http://127.0.0.1:' + freePort + '/';

  const close = () => {
    return app.close();
  };

  return {
    close,
    url
  };
};

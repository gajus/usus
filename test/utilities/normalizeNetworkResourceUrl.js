// @flow

import test from 'ava';
import normalizeNetworkResourceUrl from '../../src/utilities/normalizeNetworkResourceUrl';

test('keeps foreign URLs unchanged', (t) => {
  t.true(normalizeNetworkResourceUrl('http://foo/bar', 'http://qux/quux') === 'http://qux/quux');
  t.true(normalizeNetworkResourceUrl('http://foo/bar', 'https://foo/bar') === 'https://foo/bar');
});

test('rewrites local URLs to relative paths', (t) => {
  t.true(normalizeNetworkResourceUrl('http://foo/bar', 'http://foo/baz') === '/baz');
});

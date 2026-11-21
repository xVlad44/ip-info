import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PEER_HEADER } from './client-ip';
import { installPeerStamp } from './peer-stamp';

describe('installPeerStamp', () => {
  let server: http.Server;
  let port: number;
  const seen: (string | undefined)[] = [];

  beforeAll(async () => {
    installPeerStamp();
    installPeerStamp(); // idempotent
    server = http.createServer((req, res) => {
      seen.push(req.headers[PEER_HEADER] as string | undefined);
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('stamps the socket peer and overwrites a client-supplied value', async () => {
    await fetch(`http://127.0.0.1:${port}/`, { headers: { [PEER_HEADER]: '8.8.8.8' } });
    expect(seen.at(-1)).toBe('127.0.0.1');
  });
});

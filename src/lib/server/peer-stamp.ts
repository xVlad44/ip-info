/**
 * Records each request's TCP peer address on an internal header before Next
 * handles it. See client-ip.ts for why this exists.
 *
 * Wraps http.Server.prototype.emit for 'request' events. That reaches the
 * server `next start` (and `next dev`) already created, without a custom
 * server, so the app keeps running under plain `next start` / `npm start`.
 * Any client-supplied copy of the header is deleted first, so it cannot be
 * spoofed.
 */
import http from 'node:http';
import { PEER_HEADER } from './client-ip';

const INSTALLED = Symbol.for('ip-info.peer-stamp');

export function stampPeer(req: http.IncomingMessage): void {
  delete req.headers[PEER_HEADER];
  const addr = req.socket?.remoteAddress;
  if (addr) req.headers[PEER_HEADER] = addr;
}

export function installPeerStamp(): void {
  const proto = http.Server.prototype as http.Server & { [INSTALLED]?: boolean };
  if (proto[INSTALLED]) return;
  const originalEmit = proto.emit;
  proto.emit = function emit(this: http.Server, event: string | symbol, ...args: unknown[]) {
    if (event === 'request' && args[0] instanceof http.IncomingMessage) stampPeer(args[0]);
    return Reflect.apply(originalEmit, this, [event, ...args]) as boolean;
  } as typeof proto.emit;
  proto[INSTALLED] = true;
}

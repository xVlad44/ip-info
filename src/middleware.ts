import { NextResponse, type NextRequest } from 'next/server';
import { parseIp, unwrapIpv4Mapped } from '@/lib/ip/parse';

/**
 * One URL per address, with a real 308: /lookup/2606:4700:4700:0:0:0:0:1111
 * -> /lookup/2606:4700:4700::1111 and /lookup/::ffff:1.1.1.1 -> /lookup/1.1.1.1.
 * Done here rather than in the page because the page streams (loading.tsx), and
 * a redirect thrown mid-stream can only be a client-side one.
 */
export function middleware(request: NextRequest) {
  const segment = request.nextUrl.pathname.slice('/lookup/'.length);
  let input: string;
  try {
    input = decodeURIComponent(segment);
  } catch {
    return NextResponse.next();
  }
  const parsed = parseIp(input);
  if (!parsed) return NextResponse.next(); // the page renders the invalid-input state
  const canonical = (unwrapIpv4Mapped(parsed) ?? parsed).canonical;
  if (input === canonical) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/lookup/${canonical}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: '/lookup/:ip',
};

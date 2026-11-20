import { createLookupHandler } from '@/lib/server/handlers';
import { getServices } from '@/lib/server/instance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return createLookupHandler(getServices())(request);
}

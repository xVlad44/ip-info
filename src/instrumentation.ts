// Runs once when the Next.js server starts (next start / next dev).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installPeerStamp } = await import('./lib/server/peer-stamp');
    installPeerStamp();
  }
}

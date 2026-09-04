import { probeRuntimeTruth } from '@/lib/runtime-truth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const truth = await probeRuntimeTruth();
  return Response.json(truth, { headers: { 'cache-control': 'no-store' } });
}

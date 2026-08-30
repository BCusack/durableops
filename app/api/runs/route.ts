import { listDemoRuns } from "@/lib/demo-run-store";

export async function GET() {
  const runs = await listDemoRuns(12);

  return Response.json({
    ok: true,
    runs,
  });
}

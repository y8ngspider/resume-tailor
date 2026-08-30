import { tailorRequestSchema } from "../../../lib/schema";
import { tailorResume } from "../../../lib/openai";
import { checkRateLimit } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    const identifier = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const rate = await checkRateLimit(identifier);
    if (!rate.allowed) return Response.json({ error: "Daily tailoring limit reached. Please try again tomorrow." }, { status: 429 });
    const parsed = tailorRequestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "The tailoring request was incomplete or invalid." }, { status: 400 });
    return Response.json(await tailorResume(parsed.data), { headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch { return Response.json({ error: "We could not tailor this resume safely. Your source has not been changed." }, { status: 500 }); }
}

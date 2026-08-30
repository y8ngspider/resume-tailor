import { analyzeRequestSchema } from "../../../lib/schema";
import { validateLatexBody } from "../../../lib/latex";
import { analyzeResume } from "../../../lib/openai";
import { checkRateLimit } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    const identifier = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const rate = await checkRateLimit(identifier);
    if (!rate.allowed) return Response.json({ error: "Daily tailoring limit reached. Please try again tomorrow." }, { status: 429 });
    const parsed = analyzeRequestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Add a valid LaTeX resume body and job description." }, { status: 400 });
    const validationErrors = validateLatexBody(parsed.data.latexBody);
    if (validationErrors.length) return Response.json({ error: validationErrors.join(" ") }, { status: 400 });
    return Response.json(await analyzeResume(parsed.data.latexBody, parsed.data.jobDescription), { headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch { return Response.json({ error: "We could not analyze that source. Please check the LaTeX and try again." }, { status: 500 }); }
}

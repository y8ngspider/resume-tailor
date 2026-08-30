import { z } from "zod";
import { analyzeModelSchema, tailorModelSchema, type AnalyzeResponse, type TailorRequest, type TailorResponse } from "./schema";
import { localAnalyze, localTailor } from "./local-engine";

const apiKey = process.env.OPENAI_API_KEY;

function outputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  return response.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text ?? "";
}

async function structuredResponse<T>(name: string, schema: z.ZodType<T>, instructions: string, input: string): Promise<T> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 12_000,
        instructions,
        input,
        text: { format: { type: "json_schema", name, strict: true, schema: z.toJSONSchema(schema) } },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
    const payload = await response.json();
    return schema.parse(JSON.parse(outputText(payload)));
  } finally { clearTimeout(timeout); }
}

const analyzeInstructions = `You extract a candidate's resume evidence and role keywords. The resume is candidate evidence; the job description is market context only. Never copy a job requirement into the candidate's evidence. Preserve employers, titles, dates, metrics, ownership, tools, and qualifications exactly. Every resume bullet must cite one or more stable evidence IDs whose sourceExcerpt directly supports it. Classify each keyword as supported, partial, or unsupported. Partial means adjacent evidence, not assumed experience. Return only the requested schema.`;

const tailorInstructions = `You tailor a resume using only the supplied evidence ledger. Never invent or strengthen employers, titles, dates, credentials, technologies, metrics, scope, leadership, or ownership. Every tailored bullet must cite evidence IDs that directly support the entire claim. You may reorder, condense, and rephrase supported evidence. Unsupported keywords must go in gaps and must never become resume claims. Keep entry identity fields unchanged. Return only the requested schema.`;

export async function analyzeResume(latexBody: string, jobDescription: string): Promise<AnalyzeResponse> {
  if (!apiKey) return localAnalyze(latexBody, jobDescription);
  try {
    const result = await structuredResponse("resume_analysis", analyzeModelSchema, analyzeInstructions, JSON.stringify({ latexBody, jobDescription }));
    return { ...result, provider: "openai" };
  } catch {
    const fallback = localAnalyze(latexBody, jobDescription);
    return { ...fallback, warnings: [...fallback.warnings, "AI analysis was temporarily unavailable, so the safe local analyzer was used."] };
  }
}

function numbers(value: string): string[] { return Array.from(value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []); }

export function enforceEvidenceSafety(request: TailorRequest, result: TailorResponse): TailorResponse {
  const evidence = new Map(request.sourceResume.evidence.map((item) => [item.id, item]));
  const sourceEntries = new Map(request.sourceResume.sections.flatMap((section) => section.entries).map((entry) => [entry.id, entry]));
  const warnings = [...result.warnings];
  const sections = result.resume.sections.map((section) => ({
    ...section,
    entries: section.entries.map((entry) => {
      const source = sourceEntries.get(entry.id);
      if (!source) return entry;
      const bullets = entry.bullets.map((bullet) => {
        const sources = bullet.evidenceIds.map((id) => evidence.get(id)).filter(Boolean);
        const sourceText = sources.map((item) => `${item?.claim} ${item?.sourceExcerpt}`).join(" ");
        const unsupportedNumber = numbers(bullet.text).some((value) => !numbers(sourceText).includes(value));
        if (!sources.length || unsupportedNumber) {
          const original = source.bullets.find((item) => item.id === bullet.id) ?? source.bullets[0];
          warnings.push(`One unsupported rewrite in ${source.heading || "a section"} was restored to its source wording.`);
          return original ?? bullet;
        }
        return bullet;
      });
      return { ...entry, heading: source.heading, subheading: source.subheading, location: source.location, date: source.date, bullets };
    }),
  }));
  return { ...result, resume: { ...result.resume, contact: request.sourceResume.contact, sections, evidence: request.sourceResume.evidence }, warnings: [...new Set(warnings)] };
}

export async function tailorResume(request: TailorRequest): Promise<TailorResponse> {
  if (!apiKey) return localTailor(request);
  try {
    const result = await structuredResponse("tailored_resume", tailorModelSchema, tailorInstructions, JSON.stringify(request));
    return enforceEvidenceSafety(request, { ...result, provider: "openai" });
  } catch {
    const fallback = localTailor(request);
    return { ...fallback, warnings: [...fallback.warnings, "AI tailoring was temporarily unavailable, so no source claims were rewritten."] };
  }
}

import { z } from "zod";

export const contactSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() }).strict()),
}).strict();

export const evidenceSchema = z.object({
  id: z.string(),
  claim: z.string(),
  sourceExcerpt: z.string(),
}).strict();

export const resumeBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  evidenceIds: z.array(z.string()),
}).strict();

export const resumeEntrySchema = z.object({
  id: z.string(),
  heading: z.string(),
  subheading: z.string(),
  location: z.string(),
  date: z.string(),
  bullets: z.array(resumeBulletSchema),
}).strict();

export const sectionTypeSchema = z.enum(["summary", "experience", "projects", "education", "skills", "certifications", "other"]);

export const resumeSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: sectionTypeSchema,
  entries: z.array(resumeEntrySchema),
}).strict();

export const sourceResumeSchema = z.object({
  contact: contactSchema,
  summary: z.string(),
  sections: z.array(resumeSectionSchema),
  evidence: z.array(evidenceSchema),
}).strict();

export const supportSchema = z.enum(["supported", "partial", "unsupported"]);
export const keywordSchema = z.object({
  id: z.string(),
  text: z.string(),
  priority: z.number().int().min(1).max(3),
  support: supportSchema,
  evidenceIds: z.array(z.string()),
}).strict();

export const targetSchema = z.object({ company: z.string(), role: z.string() }).strict();

export const analyzeRequestSchema = z.object({
  latexBody: z.string().min(20).max(40_000),
  jobDescription: z.string().min(40).max(30_000),
}).strict();

export const analyzeModelSchema = z.object({
  resume: sourceResumeSchema,
  keywords: z.array(keywordSchema).min(3).max(24),
  warnings: z.array(z.string()),
  target: targetSchema,
}).strict();

export const analyzeResponseSchema = analyzeModelSchema.extend({
  provider: z.enum(["openai", "local"]),
}).strict();

export const changeSchema = z.object({
  id: z.string(),
  sourceText: z.string(),
  tailoredText: z.string(),
  reason: z.string(),
  keywords: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  kind: z.enum(["rewritten", "reordered", "unchanged"]),
}).strict();

export const coverageSchema = z.object({
  supported: z.number().int().min(0),
  partial: z.number().int().min(0),
  unsupported: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
}).strict();

export const tailorRequestSchema = z.object({
  sourceResume: sourceResumeSchema,
  keywords: z.array(keywordSchema).min(1).max(30),
  target: targetSchema,
  sectionId: z.string().nullable(),
}).strict();

export const tailorModelSchema = z.object({
  resume: sourceResumeSchema,
  changes: z.array(changeSchema),
  coverage: coverageSchema,
  gaps: z.array(z.string()),
  warnings: z.array(z.string()),
}).strict();

export const tailorResponseSchema = tailorModelSchema.extend({
  provider: z.enum(["openai", "local"]),
}).strict();

export type SourceResume = z.infer<typeof sourceResumeSchema>;
export type ResumeSection = z.infer<typeof resumeSectionSchema>;
export type ResumeEntry = z.infer<typeof resumeEntrySchema>;
export type ResumeBullet = z.infer<typeof resumeBulletSchema>;
export type TargetKeyword = z.infer<typeof keywordSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type TailorResponse = z.infer<typeof tailorResponseSchema>;
export type TailorRequest = z.infer<typeof tailorRequestSchema>;

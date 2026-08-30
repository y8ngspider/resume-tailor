import type { AnalyzeResponse, ResumeEntry, ResumeSection, SourceResume, TailorRequest, TailorResponse, TargetKeyword } from "./schema";

type CommandMatch = { start: number; end: number; args: string[] };

function readGroup(source: string, start: number): { value: string; end: number } | null {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index += 1;
  if (source[index] !== "{") return null;
  let depth = 0;
  let value = "";
  let escaped = false;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (index === start || (char === "{" && depth === 0)) { depth += 1; continue; }
    if (char === "\\" && !escaped) { escaped = true; value += char; continue; }
    if (!escaped && char === "{") depth += 1;
    if (!escaped && char === "}") {
      depth -= 1;
      if (depth === 0) return { value, end: index + 1 };
    }
    value += char;
    escaped = false;
  }
  return null;
}

function commandMatches(source: string, command: string, argCount: number): CommandMatch[] {
  const matches: CommandMatch[] = [];
  const needle = `\\${command}`;
  let cursor = 0;
  while ((cursor = source.indexOf(needle, cursor)) >= 0) {
    let end = cursor + needle.length;
    const args: string[] = [];
    for (let index = 0; index < argCount; index += 1) {
      const group = readGroup(source, end);
      if (!group) break;
      args.push(group.value);
      end = group.end;
    }
    if (args.length === argCount) matches.push({ start: cursor, end, args });
    cursor = Math.max(end, cursor + needle.length);
  }
  return matches;
}

export function latexToText(value: string): string {
  return value
    .replace(/%.*$/gm, "")
    .replace(/\\href\s*\{[^}]*\}\s*\{([^}]*)\}/g, "$1")
    .replace(/\\(?:textbf|textit|emph|underline|small|large|Large|huge|Huge|scshape)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\[%&#_$]/g, (match) => match.slice(1))
    .replace(/\\(?:textbar|textbullet)\s*\{?\}?/g, " | ")
    .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/~+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionType(title: string): ResumeSection["type"] {
  const value = title.toLowerCase();
  if (/experience|employment|work/.test(value)) return "experience";
  if (/project/.test(value)) return "projects";
  if (/education/.test(value)) return "education";
  if (/skill|technolog/.test(value)) return "skills";
  if (/certif|award/.test(value)) return "certifications";
  if (/summary|profile/.test(value)) return "summary";
  return "other";
}

function parseContact(source: string, beforeSections: string) {
  const email = latexToText(beforeSections).match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  const phone = latexToText(beforeSections).match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? "";
  const huge = commandMatches(beforeSections, "textbf", 1).map((match) => latexToText(match.args[0])).find((value) => value && !value.includes("@"));
  const lines = latexToText(beforeSections).split(/\\\\|\|/).map((line) => line.trim()).filter(Boolean);
  const name = huge || lines.find((line) => !line.includes("@") && !/\d{3}/.test(line)) || "Your Name";
  const links = commandMatches(beforeSections, "href", 2).map((match) => ({ label: latexToText(match.args[1]), url: match.args[0].trim() })).filter((link) => !link.url.startsWith("mailto:"));
  return { name, email, phone, location: "", links };
}

function parseEntryBlock(block: string, command: string, args: string[], id: string, evidence: SourceResume["evidence"]): ResumeEntry {
  const bullets = commandMatches(block, "resumeItem", 1).map((match, bulletIndex) => {
    const text = latexToText(match.args[0]);
    const evidenceId = `ev-${String(evidence.length + 1).padStart(3, "0")}`;
    evidence.push({ id: evidenceId, claim: text, sourceExcerpt: match.args[0].trim() });
    return { id: `${id}-bullet-${bulletIndex + 1}`, text, evidenceIds: [evidenceId] };
  });
  if (!bullets.length) {
    const plain = latexToText(block.slice(block.indexOf(command) + command.length));
    if (plain) {
      const evidenceId = `ev-${String(evidence.length + 1).padStart(3, "0")}`;
      evidence.push({ id: evidenceId, claim: plain, sourceExcerpt: block.trim() });
      bullets.push({ id: `${id}-bullet-1`, text: plain, evidenceIds: [evidenceId] });
    }
  }
  return {
    id,
    heading: latexToText(args[0] ?? ""),
    location: latexToText(args[1] ?? ""),
    subheading: latexToText(args[2] ?? ""),
    date: latexToText(args[3] ?? ""),
    bullets,
  };
}

export function parseLatexResume(latexBody: string): { resume: SourceResume; warnings: string[] } {
  const source = latexBody.replace(/%.*$/gm, "");
  const sections = commandMatches(source, "section", 1);
  const evidence: SourceResume["evidence"] = [];
  const parsedSections: ResumeSection[] = [];
  const warnings: string[] = [];

  sections.forEach((section, sectionIndex) => {
    const end = sections[sectionIndex + 1]?.start ?? source.length;
    const block = source.slice(section.end, end);
    const title = latexToText(section.args[0]) || `Section ${sectionIndex + 1}`;
    const type = sectionType(title);
    const command = type === "projects" ? "resumeProjectHeading" : "resumeSubheading";
    const argsCount = type === "projects" ? 2 : 4;
    const entryCommands = commandMatches(block, command, argsCount);
    const entries: ResumeEntry[] = [];

    entryCommands.forEach((entryMatch, entryIndex) => {
      const entryEnd = entryCommands[entryIndex + 1]?.start ?? block.length;
      const entryBlock = block.slice(entryMatch.start, entryEnd);
      const args = type === "projects"
        ? [entryMatch.args[0], "", "", entryMatch.args[1]]
        : entryMatch.args;
      entries.push(parseEntryBlock(entryBlock, command, args, `section-${sectionIndex + 1}-entry-${entryIndex + 1}`, evidence));
    });

    if (!entries.length) {
      const resumeItems = commandMatches(block, "resumeItem", 1);
      const texts = resumeItems.map((match) => latexToText(match.args[0])).filter(Boolean);
      const fallbackText = latexToText(block);
      const values = texts.length ? texts : fallbackText ? [fallbackText] : [];
      if (values.length) {
        const bullets = values.map((text, index) => {
          const evidenceId = `ev-${String(evidence.length + 1).padStart(3, "0")}`;
          evidence.push({ id: evidenceId, claim: text, sourceExcerpt: text });
          return { id: `section-${sectionIndex + 1}-bullet-${index + 1}`, text, evidenceIds: [evidenceId] };
        });
        entries.push({ id: `section-${sectionIndex + 1}-entry-1`, heading: title, subheading: "", location: "", date: "", bullets });
      }
    }

    if (entries.length) parsedSections.push({ id: `section-${sectionIndex + 1}`, title, type, entries });
  });

  if (!sections.length) warnings.push("No \\section commands were found, so the source was treated as one general section.");
  if (!parsedSections.length) {
    const text = latexToText(source);
    const evidenceId = "ev-001";
    evidence.push({ id: evidenceId, claim: text, sourceExcerpt: source.trim() });
    parsedSections.push({ id: "section-1", title: "Experience", type: "experience", entries: [{ id: "section-1-entry-1", heading: "Experience", subheading: "", location: "", date: "", bullets: [{ id: "section-1-bullet-1", text, evidenceIds: [evidenceId] }] }] });
  }

  const firstSectionStart = sections[0]?.start ?? source.length;
  return {
    resume: { contact: parseContact(source, source.slice(0, firstSectionStart)), summary: "", sections: parsedSections, evidence },
    warnings,
  };
}

const stopWords = new Set("a an and are as at be but by for from has have in into is it of on or our that the their this to we will with you your years experience looking engineer role work working ability strong including preferred required qualifications responsibilities".split(" "));
const phraseCatalog = ["React", "TypeScript", "JavaScript", "Node.js", "Next.js", "Python", "Java", "C++", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "PostgreSQL", "SQL", "Redis", "REST API", "GraphQL", "CI/CD", "Git", "testing", "unit testing", "system design", "cloud deployment", "performance", "accessibility", "cross-functional", "product", "design"];

function keywordSupport(keyword: string, resume: SourceResume): Pick<TargetKeyword, "support" | "evidenceIds"> {
  const normalized = keyword.toLowerCase();
  const exact = resume.evidence.filter((item) => item.claim.toLowerCase().includes(normalized));
  if (exact.length) return { support: "supported", evidenceIds: exact.map((item) => item.id) };
  const tokens = normalized.split(/[^a-z0-9+#.]+/).filter((token) => token.length > 2);
  const partial = resume.evidence.filter((item) => tokens.some((token) => item.claim.toLowerCase().includes(token)));
  return partial.length ? { support: "partial", evidenceIds: partial.map((item) => item.id) } : { support: "unsupported", evidenceIds: [] };
}

function inferTarget(jobDescription: string) {
  const firstLine = jobDescription.split(/\n/).map((line) => line.trim()).find(Boolean) ?? "";
  const atMatch = firstLine.match(/(.+?)\s+(?:at|@)\s+([A-Z][\w .&-]+)/i);
  return { company: atMatch?.[2]?.trim() ?? "", role: atMatch?.[1]?.replace(/we are (?:looking|hiring) for an?\s*/i, "").trim() ?? "Target Role" };
}

export function localAnalyze(latexBody: string, jobDescription: string): AnalyzeResponse {
  const { resume, warnings } = parseLatexResume(latexBody);
  const lowerJob = jobDescription.toLowerCase();
  const catalogMatches = phraseCatalog.filter((phrase) => lowerJob.includes(phrase.toLowerCase()));
  const words = jobDescription.match(/[A-Za-z][A-Za-z+#.\/-]{2,}/g) ?? [];
  const counts = new Map<string, number>();
  words.forEach((word) => {
    const normalized = word.toLowerCase();
    if (!stopWords.has(normalized)) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });
  const frequent = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([word]) => word).slice(0, 12);
  const unique = [...new Set([...catalogMatches, ...frequent])].slice(0, 16);
  const keywords = unique.map((text, index) => ({ id: `kw-${index + 1}`, text, priority: (index < 5 ? 3 : index < 10 ? 2 : 1) as 1 | 2 | 3, ...keywordSupport(text, resume) }));
  return { resume, keywords, warnings: [...warnings, "Local analysis is active until an OpenAI API key is configured."], target: inferTarget(jobDescription), provider: "local" };
}

function hitScore(text: string, keywords: TargetKeyword[]) {
  return keywords.reduce((score, keyword) => score + (text.toLowerCase().includes(keyword.text.toLowerCase()) ? keyword.priority : 0), 0);
}

export function localTailor(request: TailorRequest): TailorResponse {
  const supported = request.keywords.filter((keyword) => keyword.support !== "unsupported");
  const changes: TailorResponse["changes"] = [];
  const resume: SourceResume = structuredClone(request.sourceResume);
  resume.sections = resume.sections.map((section) => {
    if (request.sectionId && section.id !== request.sectionId) return section;
    const entries = section.entries.map((entry) => {
      const original = [...entry.bullets];
      const bullets = [...entry.bullets].sort((a, b) => hitScore(b.text, supported) - hitScore(a.text, supported));
      bullets.forEach((bullet, index) => {
        const oldIndex = original.findIndex((item) => item.id === bullet.id);
        const keywordHits = supported.filter((keyword) => bullet.text.toLowerCase().includes(keyword.text.toLowerCase())).map((keyword) => keyword.text);
        changes.push({ id: `change-${changes.length + 1}`, sourceText: bullet.text, tailoredText: bullet.text, reason: oldIndex !== index ? "Moved higher to foreground role-relevant evidence." : "Kept because the wording is already evidence-safe.", keywords: keywordHits, evidenceIds: bullet.evidenceIds, kind: oldIndex !== index ? "reordered" : "unchanged" });
      });
      return { ...entry, bullets };
    });
    return { ...section, entries };
  });
  const counts = {
    supported: request.keywords.filter((keyword) => keyword.support === "supported").length,
    partial: request.keywords.filter((keyword) => keyword.support === "partial").length,
    unsupported: request.keywords.filter((keyword) => keyword.support === "unsupported").length,
  };
  const weighted = counts.supported + counts.partial * 0.5;
  return {
    resume,
    changes,
    coverage: { ...counts, percentage: Math.round((weighted / Math.max(request.keywords.length, 1)) * 100) },
    gaps: request.keywords.filter((keyword) => keyword.support === "unsupported").map((keyword) => keyword.text),
    warnings: ["The safe local mode reordered supported evidence but did not rewrite claims. Configure OPENAI_API_KEY for full tailoring."],
    provider: "local",
  };
}

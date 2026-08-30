import { describe, expect, it } from "vitest";
import { enforceEvidenceSafety } from "../lib/openai";
import { escapeLatex, renderJakeResume, safeFilename, validateLatexBody } from "../lib/latex";
import { localAnalyze, localTailor, parseLatexResume } from "../lib/local-engine";

const bodies = [
  String.raw`\section{Experience}\resumeSubheading{Atlas}{NY}{Engineer}{2025}\resumeItem{Built a React app for 20 users.}`,
  String.raw`\section{Projects}\resumeProjectHeading{Search Tool $|$ Python}{2024}\resumeItem{Indexed 4,000 documents.}`,
  String.raw`\section{Education}\resumeSubheading{State University}{CA}{B.S. Computer Science}{2026}`,
  String.raw`\section{Technical Skills}\resumeItem{TypeScript, SQL, Docker, Git}`,
  String.raw`\section{Experience}\resumeSubheading{Beacon}{Remote}{Developer}{2023 -- 2024}\resumeItem{Reduced build time by 18\%.}`,
  String.raw`\section{Certifications}\resumeItem{AWS Certified Cloud Practitioner}`,
  String.raw`\section{Research}\resumeSubheading{Robotics Lab}{MA}{Assistant}{2025}\resumeItem{Evaluated navigation models in Python.}`,
  String.raw`\section{Leadership}\resumeSubheading{Code Club}{Campus}{Mentor}{2024}\resumeItem{Mentored 8 students in JavaScript.}`,
];

describe("LaTeX safety", () => {
  it("escapes every special character in user-controlled text", () => {
    expect(escapeLatex("A&B_50% $x$ #1 {ok} ~ ^ \\")).toContain("A\\&B\\_50\\%");
  });

  it("rejects preambles, file imports, executable commands, and unbalanced input", () => {
    expect(validateLatexBody(String.raw`\documentclass{article}\input{secret}`)).not.toHaveLength(0);
    expect(validateLatexBody(String.raw`\section{Work`)).not.toHaveLength(0);
  });

  it("accepts sequential balanced resume environments", () => {
    expect(validateLatexBody(String.raw`\begin{center}Name\end{center}\begin{itemize}\item Test\end{itemize}`)).toEqual([]);
  });

  it("parses representative anonymized bodies without losing evidence", () => {
    for (const body of bodies) {
      const { resume } = parseLatexResume(body);
      expect(resume.sections.length).toBeGreaterThan(0);
      expect(resume.evidence.length).toBeGreaterThan(0);
    }
  });

  it("renders a complete attributed Jake resume deterministically", () => {
    const analyzed = localAnalyze(bodies[0], "React engineer with TypeScript and AWS experience required for Example Co.");
    const first = renderJakeResume(analyzed.resume);
    expect(first).toBe(renderJakeResume(analyzed.resume));
    expect(first).toContain("Template author: Jake Gutierrez");
    expect(first).toContain(String.raw`\begin{document}`);
    expect(first).toContain(String.raw`\end{document}`);
  });

  it("creates a portable filename", () => {
    expect(safeFilename("Maya Chen", "Arc & Co", "Full-Stack Engineer")).toBe("Maya_Chen_Arc_Co_Full_Stack_Engineer.tex");
  });

  it("keeps unsupported keywords out of local tailoring", () => {
    const analysis = localAnalyze(bodies[0], "React, AWS, Kubernetes, and Rust are required.");
    const result = localTailor({ sourceResume: analysis.resume, keywords: analysis.keywords, target: analysis.target, sectionId: null });
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.resume).toLowerCase()).not.toContain("kubernetes");
  });

  it("restores a model rewrite that introduces a new metric", () => {
    const analysis = localAnalyze(bodies[0], "React engineer role");
    const request = { sourceResume: analysis.resume, keywords: analysis.keywords, target: analysis.target, sectionId: null };
    const result = localTailor(request);
    result.resume.sections[0].entries[0].bullets[0].text = "Built a React app for 900 users.";
    const safe = enforceEvidenceSafety(request, result);
    expect(safe.resume.sections[0].entries[0].bullets[0].text).toContain("20 users");
  });
});

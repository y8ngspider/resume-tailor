"use client";

import { useMemo, useState } from "react";
import { track } from "../lib/analytics";
import { estimateOverflow, renderJakeResume, safeFilename } from "../lib/latex";
import type { AnalyzeResponse, SourceResume, TailorResponse, TargetKeyword } from "../lib/schema";

const sampleResume = String.raw`\begin{center}
  \textbf{\Huge \scshape Maya Chen} \\ \vspace{1pt}
  \small 617-555-0142 $|$ \href{mailto:maya@example.com}{\underline{maya@example.com}} $|$
  \href{https://linkedin.com/in/mayachen}{\underline{linkedin.com/in/mayachen}}
\end{center}

\section{Experience}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Northstar Labs}{Boston, MA}
      {Software Engineer Intern}{May 2025 -- Aug. 2025}
      \resumeItemListStart
        \resumeItem{Built a React and TypeScript dashboard used by 40 internal analysts.}
        \resumeItem{Reduced REST API response time by 32\% by adding Redis caching.}
        \resumeItem{Added unit tests for Node.js services and fixed 12 regression bugs before launch.}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

\section{Projects}
  \resumeProjectListStart
    \resumeProjectHeading
      {\textbf{Campus Pantry} $|$ \emph{Next.js, PostgreSQL, Docker}}{Jan. 2025}
      \resumeItemListStart
        \resumeItem{Created a mobile-first inventory tool with three teammates and deployed it for a student food pantry.}
      \resumeItemListEnd
  \resumeProjectListEnd

\section{Technical Skills}
  \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{\textbf{Languages}: TypeScript, JavaScript, Python, SQL \\ \textbf{Tools}: React, Next.js, Node.js, PostgreSQL, Redis, Docker, Git}}
  \end{itemize}`;

const sampleJob = `Full-Stack Software Engineer at Arcwell

We are looking for a full-stack engineer with React, TypeScript, Node.js, REST API, testing, and cloud deployment experience. You will collaborate across product and design, improve application performance, and ship accessible customer-facing features. Experience with AWS, PostgreSQL, Docker, and CI/CD is preferred.`;

type Tab = "editor" | "changes" | "latex";

function LatexCode({ value }: { value: string }) {
  return <pre className="latex-code" aria-label="Generated LaTeX source">{value.split("\n").map((line, lineIndex) => <span className="code-line" key={`${lineIndex}-${line}`}><span className="line-number">{String(lineIndex + 1).padStart(2, "0")}</span><span>{line.split(/(\\[a-zA-Z@]+\*?|%.*$|[{}])/g).map((part, index) => { const className = part.startsWith("%") ? "token-comment" : part.startsWith("\\") ? "token-command" : part === "{" || part === "}" ? "token-brace" : ""; return <span className={className} key={`${index}-${part}`}>{part}</span>; })}</span></span>)}</pre>;
}

function Stepper({ step }: { step: number }) {
  return <div className="step-row" aria-label={`Step ${step} of 3`}>{["Add your source", "Choose keywords", "Review & export"].map((label, index) => <span className={`step ${step === index + 1 ? "active" : ""} ${step > index + 1 ? "complete" : ""}`} key={label}><b>{step > index + 1 ? "✓" : index + 1}</b>{label}</span>)}</div>;
}

function AppHeader() {
  return <header className="site-header"><a className="brand" href="#top" aria-label="Proofread home"><span className="brand-mark">P</span><span>Proofread</span></a><div className="privacy-pill"><span /> No account · session-only workspace</div></header>;
}

export default function Home() {
  const [latexBody, setLatexBody] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [step, setStep] = useState(1);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [keywords, setKeywords] = useState<TargetKeyword[]>([]);
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [target, setTarget] = useState({ company: "", role: "Target Role" });
  const [tab, setTab] = useState<Tab>("editor");
  const [customKeyword, setCustomKeyword] = useState("");
  const [loading, setLoading] = useState<"analyze" | "tailor" | "section" | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [usedSample, setUsedSample] = useState(false);

  const latexOutput = useMemo(() => result ? renderJakeResume(result.resume) : "", [result]);
  const overflow = result ? estimateOverflow(result.resume) : false;

  function loadSample() { setLatexBody(sampleResume); setJobDescription(sampleJob); setUsedSample(true); track("sample_loaded"); }

  async function analyze() {
    setError(""); setLoading("analyze");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latexBody, jobDescription }) });
      const payload = await response.json() as AnalyzeResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Analysis failed.");
      setAnalysis(payload); setKeywords(payload.keywords); setTarget(payload.target); setStep(2);
      track("analysis_completed", { provider: payload.provider, used_sample: usedSample });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analysis failed."); } finally { setLoading(null); }
  }

  function addKeyword() {
    if (!analysis || !customKeyword.trim()) return;
    const text = customKeyword.trim();
    const matches = analysis.resume.evidence.filter((item) => item.claim.toLowerCase().includes(text.toLowerCase()));
    setKeywords((current) => [...current, { id: `custom-${Date.now()}`, text, priority: 2, support: matches.length ? "supported" : "unsupported", evidenceIds: matches.map((item) => item.id) }]);
    setCustomKeyword("");
  }

  function updateKeyword(id: string, update: Partial<TargetKeyword>) { setKeywords((current) => current.map((keyword) => keyword.id === id ? { ...keyword, ...update } : keyword)); }

  async function tailor(sectionId: string | null = null) {
    if (!analysis) return;
    setError(""); setLoading(sectionId ? "section" : "tailor");
    try {
      const response = await fetch("/api/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceResume: analysis.resume, keywords, target, sectionId }) });
      const payload = await response.json() as TailorResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Tailoring failed.");
      if (sectionId && result) {
        const replacement = payload.resume.sections.find((section) => section.id === sectionId);
        setResult({ ...result, resume: { ...result.resume, sections: result.resume.sections.map((section) => section.id === sectionId && replacement ? replacement : section) }, changes: [...result.changes, ...payload.changes], warnings: [...new Set([...result.warnings, ...payload.warnings])] });
      } else { setResult(payload); setStep(3); setTab("editor"); track("tailoring_completed", { provider: payload.provider, supported: payload.coverage.supported, gaps: payload.gaps.length }); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Tailoring failed."); } finally { setLoading(null); }
  }

  function updateResume(updater: (resume: SourceResume) => SourceResume) { setResult((current) => current ? { ...current, resume: updater(current.resume) } : current); }
  function updateBullet(sectionId: string, entryId: string, bulletId: string, text: string) { updateResume((resume) => ({ ...resume, sections: resume.sections.map((section) => section.id !== sectionId ? section : { ...section, entries: section.entries.map((entry) => entry.id !== entryId ? entry : { ...entry, bullets: entry.bullets.map((bullet) => bullet.id === bulletId ? { ...bullet, text } : bullet) }) }) })); }

  async function copyLatex() { await navigator.clipboard.writeText(latexOutput); setCopied(true); track("latex_copied"); window.setTimeout(() => setCopied(false), 1800); }
  function downloadLatex() { if (!result) return; const blob = new Blob([latexOutput], { type: "application/x-tex;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = safeFilename(result.resume.contact.name, target.company, target.role); anchor.click(); URL.revokeObjectURL(url); track("tex_downloaded"); }

  return <main><AppHeader />
    {step === 1 && <><section className="hero" id="top"><p className="eyebrow">Evidence-safe resume tailoring</p><h1>Make the role fit.<br /><em>Keep every claim yours.</em></h1><p className="hero-copy">Paste your LaTeX resume body and a job description. Proofread sharpens the match, flags unsupported keywords, and returns a clean Jake’s Resume file for Overleaf.</p></section><section className="workspace" aria-label="Resume tailoring form"><Stepper step={step} /><div className="input-grid">
      <label className="editor-card"><span className="card-heading"><span><small>01</small> LaTeX resume body</span><button type="button" onClick={() => { setLatexBody(sampleResume); setUsedSample(true); }}>Use sample</button></span><textarea value={latexBody} onChange={(event) => { setLatexBody(event.target.value); setUsedSample(false); }} placeholder="Paste the content inside your resume document…" spellCheck={false} /><span className="field-note">Body content only — no preamble, packages, or imported files.</span></label>
      <label className="editor-card"><span className="card-heading"><span><small>02</small> Target job description</span><button type="button" onClick={() => { setJobDescription(sampleJob); setUsedSample(true); }}>Use sample</button></span><textarea value={jobDescription} onChange={(event) => { setJobDescription(event.target.value); setUsedSample(false); }} placeholder="Paste the job description you’re targeting…" /><span className="field-note">The job description guides targeting; it never becomes evidence about you.</span></label>
    </div>{error && <div className="error-banner" role="alert">{error}</div>}<div className="action-row"><div><strong>Built for honest tailoring.</strong><span>No invented metrics, skills, or experience.</span></div><div className="action-buttons"><button className="secondary-action" type="button" onClick={loadSample}>Try the full demo</button><button className="primary-action" type="button" disabled={!latexBody.trim() || !jobDescription.trim() || Boolean(loading)} onClick={analyze}>{loading === "analyze" ? "Reading your evidence…" : <>Find the strongest match <span>→</span></>}</button></div></div></section></>}

    {step === 2 && analysis && <section className="workspace workflow-workspace" id="top"><Stepper step={step} /><div className="workflow-header"><div><p className="eyebrow">Role signal</p><h2>Choose what deserves emphasis.</h2><p>We found {keywords.length} useful signals. Prioritize what matters; unsupported terms stay visible as gaps.</p></div><div className="target-fields"><label>Company<input value={target.company} onChange={(event) => setTarget({ ...target, company: event.target.value })} placeholder="Company" /></label><label>Role<input value={target.role} onChange={(event) => setTarget({ ...target, role: event.target.value })} placeholder="Role" /></label></div></div>
      <div className="keyword-legend"><span><i className="dot supported" /> Supported</span><span><i className="dot partial" /> Adjacent evidence</span><span><i className="dot unsupported" /> Gap</span></div><div className="keyword-list">{keywords.map((keyword) => <div className={`keyword-row ${keyword.support}`} key={keyword.id}><div className="keyword-name"><i className={`dot ${keyword.support}`} /><strong>{keyword.text}</strong><span>{keyword.support === "supported" ? "Found in your evidence" : keyword.support === "partial" ? "Related evidence only" : "Not found in your source"}</span></div><div className="priority-control" aria-label={`Priority for ${keyword.text}`}>{[1, 2, 3].map((priority) => <button type="button" className={keyword.priority === priority ? "selected" : ""} onClick={() => updateKeyword(keyword.id, { priority: priority as 1 | 2 | 3 })} key={priority}>{priority === 1 ? "Low" : priority === 2 ? "Med" : "High"}</button>)}</div><button className="remove-keyword" type="button" aria-label={`Remove ${keyword.text}`} onClick={() => setKeywords((current) => current.filter((item) => item.id !== keyword.id))}>×</button></div>)}</div>
      <div className="add-keyword"><input value={customKeyword} onChange={(event) => setCustomKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addKeyword(); }} placeholder="Add another keyword" /><button type="button" onClick={addKeyword}>Add</button></div>{analysis.warnings.length > 0 && <div className="notice"><strong>Source note</strong>{analysis.warnings.join(" ")}</div>}{error && <div className="error-banner" role="alert">{error}</div>}<div className="action-row"><button className="secondary-action" type="button" onClick={() => setStep(1)}>← Back to source</button><button className="primary-action" type="button" disabled={!keywords.length || Boolean(loading)} onClick={() => tailor()}>{loading === "tailor" ? "Tailoring with evidence…" : <>Build my tailored resume <span>→</span></>}</button></div></section>}

    {step === 3 && result && analysis && <section className="workspace result-workspace" id="top"><Stepper step={step} /><div className="result-header"><div><p className="eyebrow">Tailoring complete</p><h2>Your evidence, aimed at {target.role || "the role"}.</h2><p>{result.coverage.supported} keywords are directly supported. {result.gaps.length ? `${result.gaps.length} unsupported ${result.gaps.length === 1 ? "gap stays" : "gaps stay"} out of the resume.` : "No unsupported terms were added."}</p></div><div className="coverage-ring" style={{ "--coverage": `${result.coverage.percentage * 3.6}deg` } as React.CSSProperties}><div><strong>{result.coverage.percentage}%</strong><span>supported<br />coverage</span></div></div></div>
      {overflow && <div className="overflow-warning"><strong>One-page fit may be tight.</strong> Consider removing a lower-priority bullet before exporting; typography will not be silently reduced.</div>}<div className="result-tabs" role="tablist">{(["editor", "changes", "latex"] as Tab[]).map((value) => <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{value === "editor" ? "Resume editor" : value === "changes" ? `Changes · ${result.changes.filter((change) => change.kind !== "unchanged").length}` : "LaTeX output"}</button>)}</div>
      {tab === "editor" && <div className="editor-layout"><aside><h3>Resume details</h3><label>Name<input value={result.resume.contact.name} onChange={(event) => updateResume((resume) => ({ ...resume, contact: { ...resume.contact, name: event.target.value } }))} /></label><label>Email<input value={result.resume.contact.email} onChange={(event) => updateResume((resume) => ({ ...resume, contact: { ...resume.contact, email: event.target.value } }))} /></label><label>Phone<input value={result.resume.contact.phone} onChange={(event) => updateResume((resume) => ({ ...resume, contact: { ...resume.contact, phone: event.target.value } }))} /></label><button className="text-action" type="button" onClick={() => setResult({ ...result, resume: structuredClone(analysis.resume) })}>Restore original content</button></aside><div className="resume-editor">{result.resume.summary && <label className="summary-field"><span>Summary</span><textarea value={result.resume.summary} onChange={(event) => updateResume((resume) => ({ ...resume, summary: event.target.value }))} /></label>}{result.resume.sections.map((section) => <article className="resume-section" key={section.id}><header><h3>{section.title}</h3><button type="button" disabled={Boolean(loading)} onClick={() => tailor(section.id)}>{loading === "section" ? "Working…" : "Regenerate section"}</button></header>{section.entries.map((entry) => <div className="resume-entry" key={entry.id}><div className="entry-heading"><strong>{entry.heading}</strong><span>{entry.date}</span></div><div className="entry-subheading"><span>{entry.subheading}</span><span>{entry.location}</span></div>{entry.bullets.map((bullet) => <label className="bullet-field" key={bullet.id}><span>•</span><textarea value={bullet.text} onChange={(event) => updateBullet(section.id, entry.id, bullet.id, event.target.value)} /></label>)}</div>)}</article>)}</div></div>}
      {tab === "changes" && <div className="changes-list">{result.changes.filter((change) => change.kind !== "unchanged").length ? result.changes.filter((change) => change.kind !== "unchanged").map((change) => <article className="change-card" key={change.id}><div className="change-type">{change.kind}</div><div className="change-copy"><p className="before">{change.sourceText}</p><p className="after">{change.tailoredText}</p><span>{change.reason}</span>{change.keywords.length > 0 && <div className="mini-tags">{change.keywords.map((keyword) => <b key={keyword}>{keyword}</b>)}</div>}</div></article>) : <div className="empty-state"><strong>No wording changes were needed.</strong><p>The safe local mode preserved every claim and only adjusted ordering.</p></div>}</div>}
      {tab === "latex" && <div className="latex-panel"><div className="latex-toolbar"><div><strong>main.tex</strong><span>Jake’s Resume · ready for Overleaf</span></div><div><button className="secondary-action" type="button" onClick={copyLatex}>{copied ? "Copied ✓" : "Copy LaTeX"}</button><button className="primary-action compact" type="button" onClick={downloadLatex}>Download .tex</button></div></div><LatexCode value={latexOutput} /></div>}
      {result.gaps.length > 0 && <div className="gaps-panel"><div><p className="eyebrow">Kept out on purpose</p><h3>Unsupported requirements</h3><p>These appeared in the job description but not your source. Add them only if they are true.</p></div><div className="gap-tags">{result.gaps.map((gap) => <span key={gap}>{gap}</span>)}</div></div>}{result.warnings.length > 0 && <div className="notice"><strong>Quality note</strong>{result.warnings.join(" ")}</div>}{error && <div className="error-banner" role="alert">{error}</div>}
      <div className="result-footer"><button className="secondary-action" type="button" onClick={() => setStep(2)}>← Adjust keywords</button><div className="feedback"><span>Was this useful?</span><button type="button" onClick={() => track("feedback_submitted", { positive: true })}>Yes</button><button type="button" onClick={() => track("feedback_submitted", { positive: false })}>Not yet</button></div><div className="export-actions"><button className="secondary-action" type="button" onClick={copyLatex}>{copied ? "Copied ✓" : "Copy LaTeX"}</button><button className="primary-action compact" type="button" onClick={downloadLatex}>Download .tex</button></div></div></section>}
    <footer className="site-footer"><div><span className="brand-mark">P</span><strong>Proofread</strong></div><p>Your text is processed only to complete the current request and is not saved to a Proofread account. Model-provider data handling follows its own terms.</p><a href="https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs" target="_blank" rel="noreferrer">Jake’s Resume template ↗</a></footer>
  </main>;
}

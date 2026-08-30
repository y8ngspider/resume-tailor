import { mkdirSync, writeFileSync } from "node:fs";
import { localAnalyze, localTailor } from "../lib/local-engine";
import { renderJakeResume } from "../lib/latex";

const body = String.raw`\begin{center}\textbf{\Huge \scshape Test Candidate}\end{center}
\section{Experience}
\resumeSubheading{Example Labs}{Remote}{Software Engineer}{2025}
\resumeItem{Built a TypeScript service used by 25 teammates.}
\section{Technical Skills}\resumeItem{TypeScript, Node.js, SQL, Git}`;
const analysis = localAnalyze(body, "Software Engineer at Example Co. React, TypeScript, Node.js, SQL, and AWS experience.");
const tailored = localTailor({ sourceResume: analysis.resume, keywords: analysis.keywords, target: analysis.target, sectionId: null });
mkdirSync(".artifacts", { recursive: true });
writeFileSync(".artifacts/resume-fixture.tex", renderJakeResume(tailored.resume));

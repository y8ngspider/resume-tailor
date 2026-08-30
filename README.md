# Proofread

Proofread tailors a LaTeX resume to a job description without turning missing requirements into invented experience. It extracts a source-only evidence ledger, lets the user choose target keywords, returns an editable draft, and renders a complete [Jake's Resume](https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs) `.tex` file for Overleaf.

**[Try the public demo](https://proofread-resume-tailor.y8ng.chatgpt.site)** — choose “Use sample” in both editors to run the full workflow without sharing personal information.

## Why this project exists

Most resume generators optimize for fluent text. Proofread optimizes for traceable claims:

- Job descriptions are targeting context, never candidate evidence.
- Every generated bullet carries one or more source evidence IDs.
- Employers, titles, dates, metrics, and credentials are protected fields.
- Novel numeric claims are rejected and restored to source wording.
- Unsupported keywords are shown as gaps instead of being inserted.
- The model returns structured data; deterministic application code renders LaTeX.

## Architecture

```text
LaTeX body + job description
        │
        ▼
input validation ── rejects preambles, imports, executable commands
        │
        ▼
structured analysis ── source resume + evidence ledger + target keywords
        │
        ▼
user keyword review ── supported / adjacent / unsupported
        │
        ▼
evidence-constrained tailoring ── protected fields + numeric-claim guard
        │
        ▼
deterministic Jake template renderer ── copy or download main.tex
```

The deployed app uses the OpenAI Responses API with `gpt-5.6-luna`, low reasoning, Structured Outputs, and `store: false` when `OPENAI_API_KEY` is configured. Without a key, a deliberately conservative local engine parses and reorders supported evidence so the sample demo remains usable.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` for full rewriting. Upstash and PostHog variables are optional. Analytics events contain only workflow metadata; resume text, names, job descriptions, and keywords are never attached.

## Quality checks

```bash
npm test
npm run build
npm run fixture:tex
```

The test suite covers special-character escaping, unsafe input, eight anonymized resume shapes, deterministic output, filename safety, unsupported keyword exclusion, and novel-metric rejection. GitHub Actions also compiles a rendered fixture with `pdflatex`. A Playwright test covers the sample-to-download journey.

## Product trade-offs

The first release intentionally supports one pasted resume body, English-language technology resumes, and one pinned output template. It does not support arbitrary preambles, multi-file Overleaf projects, accounts, saved histories, PDF/DOCX conversion, job scraping, or universal “ATS scores.”

## Template attribution

The output renderer is based on Jake Gutierrez's archived [MIT-licensed resume template](https://github.com/jakegut/resume), itself based on `sb2nov/resume`. Attribution remains in every generated `.tex` file.

<a id="readme-top"></a>

<div align="center">
  <img src="public/og.png" alt="Proofread — Tailor the role. Keep the truth." width="760">

  <h1>Proofread</h1>

  <p>
    Evidence-safe resume tailoring for LaTeX users.
    <br />
    Turn one source resume and a job description into a complete, editable
    <code>main.tex</code> without inventing experience.
  </p>

  <p>
    <a href="https://github.com/y8ngspider/resume-tailor/issues">Report an issue</a>
  </p>

  <p>
    <a href="https://github.com/y8ngspider/resume-tailor/actions/workflows/ci.yml">
      <img src="https://github.com/y8ngspider/resume-tailor/actions/workflows/ci.yml/badge.svg" alt="CI status">
    </a>
    <img src="https://img.shields.io/badge/Next.js-App_Router-000000?logo=nextdotjs" alt="Next.js App Router">
    <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/output-LaTeX-008080?logo=latex&logoColor=white" alt="LaTeX output">
  </p>
</div>

<details>
  <summary>Table of contents</summary>
  <ol>
    <li><a href="#about">About</a></li>
    <li><a href="#how-it-works">How it works</a></li>
    <li><a href="#evidence-safety">Evidence safety</a></li>
    <li><a href="#built-with">Built with</a></li>
    <li><a href="#getting-started">Getting started</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#testing">Testing</a></li>
    <li><a href="#scope">Scope</a></li>
    <li><a href="#template-attribution">Template attribution</a></li>
  </ol>
</details>

## About

Proofread accepts the body of an existing LaTeX resume and a job description. It extracts job keywords, checks each keyword against source evidence, lets the user choose what to prioritize, and produces a complete [Jake's Resume](https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs) document that can be pasted directly into Overleaf.

The product is designed around one constraint: a polished resume is useful only if every claim remains true. Job descriptions are treated as targeting context, never as evidence about the candidate.

The app includes sample inputs, so the complete workflow can be tested locally without entering personal information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How it works

```text
LaTeX resume body + job description
                 │
                 ▼
       validate and sanitize input
                 │
                 ▼
   build a source-only evidence ledger
                 │
                 ▼
 extract and classify target keywords
                 │
                 ▼
       user reviews priorities
                 │
                 ▼
 evidence-constrained structured rewrite
                 │
                 ▼
 deterministic Jake template renderer
                 │
                 ▼
       copy or download main.tex
```

The model returns structured resume data rather than raw LaTeX. Application code then escapes user-controlled text and renders the final document deterministically. The same structured input always produces the same `.tex` output.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Evidence safety

- Every rewritten bullet references one or more source evidence IDs.
- Employers, titles, dates, education, certifications, technologies, metrics, and scope cannot be invented.
- Numeric claims that do not exist in the source are rejected.
- Supported content may be reordered, shortened, emphasized, or rephrased.
- Unsupported requirements remain visible gaps and never become resume claims.
- Dangerous LaTeX commands, preambles, and multi-file imports are rejected.
- Analytics events never include resume text, names, job descriptions, or keywords.

When `OPENAI_API_KEY` is unavailable, Proofread uses a conservative local engine that parses and reorders supported evidence without generating new claims.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built with

- [Next.js](https://nextjs.org/) App Router, React, and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for the interface
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) with Structured Outputs
- [Zod](https://zod.dev/) for shared API and domain validation
- Deterministic TypeScript rendering for Jake's Resume
- [Upstash Redis](https://upstash.com/) for optional distributed rate limiting
- [PostHog](https://posthog.com/) for optional content-free product events
- [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/) for automated testing

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

### Prerequisites

- Node.js 22.13 or newer
- npm

### Installation

```bash
git clone git@github.com:y8ngspider/resume-tailor.git
cd resume-tailor
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional environment variables

Create `.env.local` to enable hosted services:

```bash
OPENAI_API_KEY=your_openai_api_key

UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Only `OPENAI_API_KEY` changes tailoring behavior. Upstash and PostHog are optional; the app remains usable without them.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

1. Paste the content of a LaTeX resume, excluding the preamble and `document` environment.
2. Paste the target job description.
3. Analyze the role and review the extracted keywords.
4. Remove or reprioritize keywords before tailoring.
5. Review the structured resume, change log, coverage, and unsupported gaps.
6. Edit supported fields if needed.
7. Copy the complete LaTeX or download the generated `.tex` file.
8. Use the result as `main.tex` in a blank Overleaf project.

The input parser accepts common resume commands and environments but does not attempt to support arbitrary LaTeX projects.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Testing

```bash
npm test
npm run test:e2e
npm run build
npm run fixture:tex
```

The automated checks cover:

- LaTeX escaping and deterministic rendering
- Unsafe input and unsupported command rejection
- Eight anonymized resume shapes
- Filename safety and malformed links
- Evidence references and keyword coverage
- Unsupported-keyword and novel-metric exclusion
- The sample-to-download browser workflow
- Fixture compilation with `pdflatex` in CI

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Scope

The first release focuses on English-language software and technology resumes, one pasted LaTeX body, and one pinned output format.

Intentionally out of scope:

- Arbitrary full LaTeX documents or multi-file projects
- PDF and DOCX import or export
- Direct Overleaf integration
- Multiple resume templates
- Accounts, saved histories, payments, or a database
- Cover letters and job-board scraping
- Claims of a universal “ATS score”

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Template attribution

The output renderer is based on Jake Gutierrez's archived [MIT-licensed resume template](https://github.com/jakegut/resume), itself based on `sb2nov/resume`. The upstream attribution is retained in every generated `.tex` file.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

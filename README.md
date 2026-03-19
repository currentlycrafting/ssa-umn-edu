# SSA Website & Board Operations Platform

Public website and internal board management platform for the **Somali Student Association** at the University of Minnesota, Twin Cities.

---

## Overview

This is a dual-purpose Node.js application:

- **Public site** — homepage (`index.html`), involvement page (`join.html`), and newsletter viewer (`newsletter.html`) for the SSA community.
- **Ops dashboard** — role-based internal platform where the Executive President, Vice Presidents, and Board Members manage tasks, events, reports, and site content.

The stack is deliberately simple: **Express + SQLite + vanilla HTML/CSS/JS**. No bundler, no framework, no build step. Pages are served directly as static files, with a REST API powering all dynamic data.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Authentication & Roles](#authentication--roles)
6. [Ops Dashboards](#ops-dashboards)
7. [Public Pages](#public-pages)
8. [AI Integrations](#ai-integrations)
9. [Newsletter Platform](#newsletter-platform)
10. [GitHub Push System](#github-push-system)
11. [Database Schema](#database-schema)
12. [API Reference](#api-reference)
13. [CSS Architecture](#css-architecture)
14. [Deployment](#deployment)

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill environment variables
cp .env.example .env

# Start the server
npm start
```

The server starts at `http://localhost:5600` by default (configurable via `PORT`).

On first run, the SQLite database (`ssa-ops.db`) is created automatically, the schema is initialized, and the default board roster is seeded.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default `5600`) |
| `DATA_DIR` | No | Persistent storage directory for deployed environments (e.g. `/data` on Render). Database and uploads live here. Defaults to project root. |
| `GOOGLE_CLIENT_ID` | For prod | Google OAuth 2.0 client ID — restricts login to `@umn.edu` accounts |
| `GOOGLE_CLIENT_SECRET` | For prod | Google OAuth client secret |
| `GEMINI_API_KEY` | For AI features | Google Gemini API key — powers event task generation and newsletter drafting |
| `GITHUB_TOKEN` | For push | GitHub personal access token (repo scope) for pushing content to the static site repo |
| `GITHUB_REPO` | For push | Repository URL (e.g. `https://github.com/org/repo`) |
| `GITHUB_BRANCH` | For push | Target branch (default `dev`) |
| `GIT_USER_EMAIL` | For push | Committer email for GitHub pushes |
| `GIT_USER_NAME` | For push | Committer name for GitHub pushes |

When `GOOGLE_CLIENT_ID` is not set, the login page falls back to a dev email input (any seeded `@umn.edu` email works).

---

## Project Structure

```
ssa-website/
├── server.js                    # Express server — all API routes + static file serving
├── package.json
├── .env / .env.example
│
├── lib/
│   ├── sqlite.js                # Database schema, migrations, seed users
│   ├── newsletter-platform.js   # AI newsletter generation + publishing
│   └── github-push.js           # GitHub Contents API helper
│
├── data/
│   ├── events.json              # Homepage calendar events
│   ├── newsletter.json          # Newsletter card data
│   ├── newsletters.json         # Newsletter edition archive
│   ├── current-newsletter.json  # Pointer to current edition
│   └── newsletter-design-contract.md  # LLM prompt for newsletter generation
│
├── css/
│   ├── tokens.css               # Design tokens (CSS variables)
│   ├── base.css                 # Base styles / reset
│   ├── layout.css               # Page shell layout
│   ├── components.css           # Shared UI components
│   ├── utilities.css            # Utility classes
│   ├── president.css            # President dashboard styles
│   ├── vp.css                   # VP dashboard styles
│   ├── board.css                # Board member dashboard styles
│   ├── ops-login.css            # Login page styles
│   ├── public-shared.css        # Shared public page styles
│   ├── index.css                # Homepage-specific styles
│   └── join.css                 # Join page-specific styles
│
├── js/
│   ├── ops-common.js            # Shared ops utilities (sessions, polling)
│   ├── president-core.js        # President UI core
│   ├── president-live.js        # President API integration
│   ├── vp-core.js               # VP UI core
│   ├── vp-live.js               # VP API integration
│   ├── board-app.js             # Board member app logic
│   ├── newsletter-admin.js      # Newsletter admin UI
│   ├── site-data.js             # Public site default data
│   ├── site-render.js           # Public site dynamic rendering
│   ├── site-ui.js               # Public site UI interactions
│   ├── site-admin.js            # Public site inline editing
│   ├── site-init.js             # Public site initialization
│   └── join.js                  # Join page logic
│
├── assets/
│   ├── about/                   # About section images
│   ├── board-members/           # Board member photos (parsed from filenames)
│   ├── events/                  # Event poster images
│   ├── gallery/                 # Photo gallery images
│   ├── logos/                   # SSA logo + social logos
│   └── newsletter-images/       # Newsletter thumbnails
│
├── newsletters/
│   ├── current.html             # Current newsletter HTML
│   └── editions/                # Archived newsletter editions
│
├── uploads/                     # File upload destination
│
├── index.html                   # Public homepage
├── join.html                    # Public involvement page
├── newsletter.html              # Public newsletter viewer
├── ops-login.html               # Ops login page
├── president.html               # President dashboard
├── vp.html                      # Vice President dashboard
└── board.html                   # Board member dashboard
```

---

## Architecture

### Backend

`server.js` is a single Express application that handles everything:

- **Static file serving** with appropriate caching headers (1-year immutable for images, no-cache for dynamic assets)
- **REST API** (~60 endpoints) for authentication, dashboard data, task lifecycle, event management, site content, reports, and GitHub integration
- **SQLite database** via `better-sqlite3` in WAL mode for concurrent read performance
- **Session management** with 8-hour TTL tokens, hourly expiry purge
- **File uploads** via `multer` for task attachments, gallery photos, board member photos, and newsletter images
- **Site content caching** with a 30-second TTL to reduce filesystem reads on the public `/api/public/site-content` endpoint

### Frontend

All pages are vanilla HTML/CSS/JS with no build step. The ops dashboards follow a consistent pattern:

1. **Core script** (`*-core.js`) — UI rendering, navigation, modals, placeholder data
2. **Live script** (`*-live.js`) — API integration that hydrates the UI with real backend data, overrides core functions via `window.*`
3. **Shared scripts** — `ops-common.js` (session/polling), `newsletter-admin.js` (newsletter editor)

The public pages use a similar pattern: `site-data.js` → `site-render.js` → `site-ui.js` → `site-admin.js` → `site-init.js`.

### Data Flow

```
Browser (ops dashboard)
  ↕ x-session-token header
Express server.js
  ↕ better-sqlite3 (synchronous)
ssa-ops.db (SQLite)

Browser (public site)
  ↕ fetch
Express → getCachedSiteContent()
  → reads site-content.json + gallery/ + board-members/ folders
```

Dashboard pages poll `/api/dashboard` every 30 seconds to stay current.

---

## Authentication & Roles

### Login Flow

1. User visits `ops-login.html` and selects a workspace mode (President, VP Internal, VP External, or Board Member)
2. Signs in with Google (`@umn.edu` accounts only) or dev email bypass
3. Server verifies the credential, checks the email against the seeded user roster, validates the requested role matches the user's permission level
4. Returns a session token (stored in `localStorage`) + redirects to the appropriate dashboard

### Role Hierarchy

| Level | Users | Access |
|---|---|---|
| **President** | 2 Executive Presidents | Full access — all tasks, events, reports, site content, GitHub push, seed user management |
| **VP** | 2 Vice Presidents (Internal + External) | Division-scoped — tasks in their division, approve/redo, event management, gallery, newsletter |
| **Board** | ~10 Directors / Executive Producers | Personal — assigned tasks, submit completions, view events, gallery management, VP escalation |

VPs are further scoped by **division type** (`internal` or `external`), which determines which tasks and members they can see.

### User Roster

Board members are defined in `lib/sqlite.js` → `seedUsers()`. This hardcoded roster is the source of truth for who can log in. The president can edit and push this file from the dashboard.

---

## Ops Dashboards

### President (`president.html`)

The command center for the organization. Key features:

- **Overview** — live stats, recent tasks, event control panels
- **Task management** — view all tasks, assign with smart suggestions (role-matched + workload-balanced), approve submissions, request redos, mark overdue
- **Event creation wizard** — multi-step form → Gemini AI generates a task plan → review/edit → publish event + tasks with dependency graph
- **Dependency graph** — visual task dependency map filterable by event
- **Board workload** — per-member task counts and completion rates
- **Reports** — review escalation reports from VPs
- **Site admin** — manage gallery photos, board member photos, homepage events, newsletter content, and push everything to GitHub
- **Newsletter platform** — AI-powered newsletter generation, editing, and publishing

### Vice President (`vp.html`)

Division-scoped management. URL parameter `?division=internal|external` sets the scope.

- **Division hub** — overview stats, review queue, alerts, member snapshot
- **Task management** — division tasks, personal tasks, assign tasks, approve/redo
- **Events** — view events, dependency graph, calendar
- **Reports** — submit escalation reports to the President, view board member reports
- **Suggestion box** (Internal VP only) — review public suggestions from the join page
- **Newsletter** — same editor as President for authorized roles
- **Gallery** — manage homepage photos

### Board Member (`board.html`)

Personal workspace for individual board members.

- **My tasks** — dashboard with KPI cards, task list across all statuses
- **Task submission** — multi-step completion form (summary, proof links, file uploads, difficulty rating, quality self-assessment, feedback)
- **Events & calendar** — view events, dependency graph, deadline calendar
- **Report to VP** — escalation form with severity levels and issue types
- **Gallery** — manage homepage photos

---

## Public Pages

### Homepage (`index.html`)

The main public-facing page with sections for:

- Hero with animated text
- Mission statement and stats
- Signature event (Somali Night) spotlight
- About SSA
- Events calendar (populated from API)
- Newsletter cards
- Photo gallery with lightbox viewer
- Board leadership cards
- Alumni section and call-to-action

**Design:** Dark navy (`#0b0f1c`) background with gold (`#b89a5c`) accents, Cormorant Garamond display font, DM Sans body font, scroll-reveal animations, and a cursor glow effect.

Data is fetched from `/api/public/site-content` on load and dynamically rendered.

### Join Page (`join.html`)

Comprehensive involvement page covering:

- Board roles with expandable detail modals
- How the organization works (voting, meetings, structure)
- Intern program and committee tracks
- Events overview
- Code of conduct
- Application information
- **Suggestion box** — public form that submits to `/api/suggestions` (routed to Internal VP)
- Funding information

### Newsletter (`newsletter.html`)

Minimal viewer page that loads the current newsletter (`newsletters/current.html`) in a styled iframe.

---

## AI Integrations

### Event Task Generation (Gemini 2.5 Flash)

When creating a new event, the President or VP can have Gemini generate a complete task plan:

1. Admin fills in event details (name, date, type, scope, budget, roles, etc.)
2. `POST /api/events/generate` sends the event details + the full board roster to Gemini
3. Gemini returns a structured JSON payload of tasks with titles, descriptions, role assignments, phases, priorities, dependencies, goals, success criteria, and anti-patterns
4. Admin reviews, edits, adds, or removes generated tasks
5. Publishing creates the event + all tasks + dependency graph in the database

### Newsletter Generation (Gemini 2.5 Flash)

The newsletter platform uses a detailed design contract (`data/newsletter-design-contract.md`) as a system prompt:

1. Admin provides edition metadata + optional source text + uploaded PDFs/images
2. PDFs are heuristically parsed for text content
3. Gemini generates a complete, self-contained HTML newsletter following the brand spec
4. Output is validated for required sections and CSS classes
5. Failed validation triggers an automatic repair pass
6. Admin previews, edits inline, then publishes

---

## Newsletter Platform

A full-featured newsletter system managed from the ops dashboard:

- **Generation** — AI-powered or template-based HTML newsletter creation
- **Editing** — inline HTML editing with live preview
- **Publishing** — saves to `newsletters/current.html`, archives to `newsletters/editions/`, updates metadata in `data/newsletters.json`
- **GitHub push** — pushes HTML files, images, and archive data to the static site repo
- **Public viewing** — `newsletter.html` loads the current edition in an iframe
- **Design contract** — a ~390-line specification defining the SSA newsletter brand (tokens, typography, layout sections, image rules, and LLM generation constraints)

**Permissions:** President, Internal VP, or Director of Operations.

---

## GitHub Push System

The ops dashboard can push content directly to the GitHub repository so changes go live on the static site:

| Push Action | Files Pushed |
|---|---|
| Push Gallery | All images in `assets/gallery/` |
| Push Board | `site-content.json` + all images in `assets/board-members/` |
| Push Events | `data/events.json` + `site-content.json` |
| Push Newsletter | `data/newsletter.json` + images in `assets/newsletter-images/` |
| Push Site Content | `data/site-content.json` (gallery + board orders) |
| Publish Newsletter Edition | Newsletter HTML + edition archive + images |

Uses the GitHub Contents API (GET SHA → PUT create/update) via `lib/github-push.js`.

---

## Database Schema

SQLite database (`ssa-ops.db`) with WAL mode enabled.

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | Board member roster | `email` (PK), `role_title`, `department`, `permission_level`, `view_type`, `vp_type` |
| `sessions` | Authentication sessions | `token` (PK), `user_email`, `expires_at` |
| `events` | Organization events | `name`, `event_date`, `event_type`, `scope`, `progress`, `status`, `workflow_json`, `divisions_json`, `roles_json` |
| `tasks` | Task assignments | `title`, `owner_email`, `status`, `due_at`, `priority`, `phase`, `event_id`, `vp_scope`, `visibility` |
| `task_dependencies` | Prerequisite graph | `task_id`, `depends_on_task_id` |
| `task_submissions` | Completion submissions | `task_id`, `summary`, `proof_links`, `difficulty`, `feedback` |
| `redo_requests` | Admin redo requests | `task_id`, `notes`, `updated_due_at` |
| `reports` | Escalation reports | `submitted_by_email`, `reason`, `notes`, `escalated_to`, `target_vp_type`, `status` |
| `suggestions` | Public suggestions | `submitter_name`, `suggestion_type`, `idea_text`, `audience` |

**Task statuses:** `locked` → `current` → `pending_review` → `completed` / `redo` / `overdue`

**Report flow:** Board → VP (`escalated_to: 'vp'`) or VP → President (`escalated_to: 'president'`)

---

## API Reference

### Public Endpoints (no auth)

```
GET   /api/health                         Health check
GET   /api/config/public                  Client config (Google OAuth status, Gemini status)
GET   /api/public/site-content            Full site data (gallery, board, newsletters, events)
GET   /api/public/newsletter/current      Current newsletter metadata + HTML path
POST  /api/suggestions                    Submit suggestion from join page
```

### Authentication

```
POST  /api/auth/google                    Google OAuth sign-in
POST  /api/auth/dev                       Dev email login (no Google token required)
GET   /api/me                             Current authenticated user
```

### Dashboard

```
GET   /api/dashboard                      Full dashboard (tasks, events, deps, users, reports)
GET   /api/poll                           Lightweight poll (auto-marks overdue, returns counts)
GET   /api/notifications                  Rich notification feed
```

### Tasks

```
GET   /api/tasks/all-for-prereq           All tasks for dependency picker (admin)
POST  /api/tasks/assign                   Create + assign task (admin)
PATCH /api/tasks/:id                      Edit task (admin)
DELETE /api/tasks/:id                     Delete task (admin)
POST  /api/tasks/:id/submit              Submit completion (JSON)
POST  /api/tasks/:id/submit-form         Submit completion (multipart with files)
POST  /api/tasks/:id/approve             Approve submission (admin)
POST  /api/tasks/:id/redo                Request redo (admin)
```

### Events

```
POST  /api/events/generate               AI-generate task plan via Gemini
POST  /api/events/publish                 Create event + tasks in database
PATCH /api/events/:id                     Edit event
DELETE /api/events/:id                    Delete event + all related data
```

### Site Content

```
POST  /api/site/gallery                   Add gallery photo
PUT   /api/site/gallery                   Get gallery (backward compat)
DELETE /api/site/gallery/file/:filename   Remove gallery photo
PUT   /api/site/gallery-order             Reorder gallery
POST  /api/site/board/upload              Upload board member photo
GET   /api/site/board                     Get board members
DELETE /api/site/board/file/:filename     Remove board member
PUT   /api/site/board-order               Reorder board
PUT   /api/site/newsletters               Save newsletter data
POST  /api/site/newsletter-image          Upload newsletter image
```

### Newsletter Platform

```
GET   /api/newsletter/admin/state         Newsletter admin state
PUT   /api/newsletter/current             Save newsletter HTML
POST  /api/newsletter/generate-draft      Generate draft via Gemini (multipart)
POST  /api/newsletter/publish             Publish edition
```

### GitHub Push (President only)

```
POST  /api/site/push                      Push site-content.json
POST  /api/site/push-gallery              Push gallery images
POST  /api/site/push-board                Push board content + images
POST  /api/site/push-events               Push events
POST  /api/site/push-newsletter           Push newsletter data + images
```

### Reports & Admin

```
POST  /api/reports                        Submit escalation report
PATCH /api/reports/:id                    Update report status
GET   /api/suggestions                    List suggestions (internal VP only)
GET   /api/admin/seed-users-snippet       Read seed function source
POST  /api/admin/run-seed                 Re-run seed users
POST  /api/admin/seed-users-push          Push seed file to GitHub
GET   /api/assign/suggestions             Smart assignee suggestions
```

---

## CSS Architecture

### Ops Pages (layered system)

```
tokens.css       → CSS custom properties (colors, fonts, spacing, shadows)
base.css         → Element resets and defaults
layout.css       → Page shell (sidebar, main area, topbar, grid layouts)
components.css   → Shared components (cards, modals, badges, forms, buttons)
utilities.css    → Single-purpose utility classes
[page].css       → Page-specific overrides (president.css, vp.css, board.css)
```

### Public Pages

```
public-shared.css → Shared tokens, typography, and base for public pages
index.css         → Homepage-specific styles
join.css          → Join page-specific styles
```

### Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--navy` | `#0b0f1c` | Primary background |
| `--navy-mid` | `#111726` | Card backgrounds |
| `--navy-light` | `#161c2e` | Input/elevated surfaces |
| `--gold` | `#b89a5c` | Primary accent |
| `--gold-light` | `#d4b87a` | Hover/active gold |
| `--white` | `#f8f6f2` | Primary text |
| `--silver` | `#9a9fad` | Secondary text |
| `--green` | `#4caf7d` | Success/completed |
| `--red` | `#c0504d` | Error/overdue |
| `--amber` | `#d4914a` | Warning/redo |

Fonts: **Cormorant Garamond** (display), **DM Sans** (body).

---

## Deployment

### Prerequisites

- Node.js 18+
- No build step required

### Production Checklist

1. Set all environment variables (especially `GOOGLE_CLIENT_ID` for real auth)
2. Set `DATA_DIR` to a persistent volume if deploying to a platform like Render
3. Ensure the SQLite database path (`$DATA_DIR/ssa-ops.db`) is on persistent storage
4. The `uploads/` directory should also be on persistent storage
5. Configure Google OAuth authorized origins to include your production domain

### Running

```bash
# Production
NODE_ENV=production npm start

# Development (identical — no separate dev server needed)
npm start
```

The server listens on `PORT` (default `5600`) and serves everything from a single process.

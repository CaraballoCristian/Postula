# 🚀 PostulaTool

Local job-application management tool that centralizes and automates **personalized application message generation** (recruiter email, company message, employee contact message) and **tracks the full history** of every application.  
Built with focus on **data integrity, template-driven personalization and a clean local-first architecture**.

---

## 🚀 Installation & Setup

```bash
# Clone the repository
git clone https://github.com/CaraballoCristian/PostulaTool.git

cd PostulaTool

# Backend (dev, hot-reload)
cd server
npm install
npm run dev

# Frontend (dev)
cd client
npm install
npm start

# Open in browser
http://localhost:4200
```

```bash
# Backend build + prod
cd server && npm run build

# Frontend build (output: client/dist/client)
cd client && npm run build

# The Express server serves both the API (/api) and the built SPA in production
```

---

## 🖼️ Preview

![PostulaTool Preview](./preview.png)

---

## ✨ Features

- ✉️ **Template-driven message generation** — email, company message and recruiter message from reusable `{placeholder}` templates
- 🌍 **Multi-language & multi-category templates** — different tone per role (Tech, Management) and language (ESP/ENG)
- 📋 **Filterable application history** — search, sort and filter by category, language and status tag
- ⭐ **Favorites, notes and links** per application
- 🏷️ **Custom status tags** — create, rename (with propagation) and delete (with mandatory reassignment). The status column is a real foreign key to `tags` (delete is `RESTRICT` when in use, rename cascades to applications)
- 🔄 **Bulk status updates** — change the status of multiple applications at once
- 🗑️ **Trash (soft delete)** — deleted applications go to a trash, from where they can be restored or permanently purged
- 💾 **Backup / Restore** — export the full database as JSON and restore/import it from the Settings → Backup tab
- 📎 **One-click copy** — copy individual messages or all generated messages at once
- 🎨 **Custom accent color & dark/light theme**
- 🛠️ **Versioned DB migrations** — schema tracked via SQLite `user_version`, with each migration applied once and idempotently (structural guards so re-running is a no-op), plus a repair routine for a legacy column-shift corruption bug verified against a backup before touching the real database

---

## 🛠️ Tech Stack

**Frontend**

- [Angular 19](https://angular.dev/) (standalone components, signals)
- [Tailwind CSS 3.4](https://tailwindcss.com/)
- [RxJS 7.8](https://rxjs.dev/)
- TypeScript 5.7

**Backend**

- [Node.js](https://nodejs.org/) + [Express 4.21](https://expressjs.com/)
- [better-sqlite3 11.7](https://github.com/WiseLibs/better-sqlite3) (synchronous SQL, transactions)
- TypeScript 5.6

**Database**

- SQLite (WAL journal mode, foreign keys enforced)

---

## 📂 Project Structure

```bash
PostulaTool/
├── client/
│   └── src/app/
│       ├── components/
│       │   ├── nueva-postulacion/    # message generation flow
│       │   ├── historial/            # application table + filters + bulk actions
│       │   ├── editor-templates/     # template CRUD
│       │   ├── configuracion/        # categories, languages, tags, general config
│       │   ├── dropdown/             # generic dropdown
│       │   └── dialog/               # confirm/toast
│       ├── services/
│       │   ├── api.service.ts        # HTTP client to /api
│       │   ├── shared-state.service.ts  # signals for cross-tab refresh
│       │   ├── clipboard.service.ts
│       │   └── theme.service.ts
│       └── models/interfaces.ts      # types + constants
│
└── server/
    ├── src/
    │   ├── index.ts                  # Express app, initDB + seed, routes
    │   ├── db.ts                     # schema, migrations, data repair
    │   ├── seed.ts                   # default categories/templates/tags
    │   └── routes/                   # categorias, idiomas, tags, templates, postulaciones, config
    └── data/postulatool.sqlite       # local database
```

---

## 🗄️ Data Model (SQLite)

- `categorias` — application categories (e.g. Tech, Management)
- `templates` — message templates by category, language and type (`email` / `mensaje_empresa` / `mensaje_recruiter`)
- `postulaciones` — each application: company, offer, contact, generated messages, status (FK→`tags`), favorite, notes, links, soft-delete flag (`deleted_at`)
- `idiomas` — supported languages
- `tags` — status tags (color-coded, rename with `ON UPDATE CASCADE`, delete with `ON DELETE RESTRICT`)
- `config` — user profile defaults used to auto-fill templates

---

## 🔧 Notes on data integrity

An early legacy migration copied rows positionally (`INSERT ... SELECT *`), which caused a column-shift corruption after the schema changed. The fix required:

- Detecting the corruption pattern (`favorito NOT IN (0,1)`, `estado` matching a date format instead of a status)
- Writing two idempotent repair queries, validated against a backup copy before running on the real database
- Rebuilding all migrations to insert by column name instead of by position

Schema evolution now uses **PRAGMA `user_version`**: `db.ts` defines an ordered list of versioned migrations (`addMigration`), applies only the pending ones inside a single transaction, and bumps `user_version` after each step. Every migration is written with structural guards (`hasColumn`, `hasCheck`) so it acts as a no-op if its change is already present.

---

👨‍💻 Author

Developed by **Cristian Caraballo**

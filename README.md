# 🛒 BuySense

> **Smart Shopping Intelligence & Decision Support System**

BuySense is a full-stack laptop storefront with a brain. It pairs a polished shopping experience with an explainable decision engine, so customers can choose a laptop based on what actually matters to them — not just the lowest price.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![TanStack](https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactquery&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)

---

## ✨ What makes it different?

| 🧠 Decision support | 🛍️ Storefront | ⚙️ Admin |
|---|---|---|
| **AHP** criteria weighting | Search, filter and sort laptops | Revenue, orders and inventory KPIs |
| **TOPSIS** alternative ranking | Product pages with full specs | Product management |
| **What-If Simulator** | Compare up to 5 laptops | Order status management |
| Explainable recommendations | Cart, wishlist and COD checkout | Stock and sales reports |

The DSS is not a black box: criteria weights, rankings and the reasoning behind each recommendation are visible, and shoppers can adjust priorities in real time.

## 🧰 Tech stack

- **Frontend:** React 19, TypeScript, TanStack Start/Router, Tailwind CSS 4, shadcn/ui, Radix UI, Lucide
- **Backend:** TanStack server functions, Supabase Auth, PostgreSQL, Row Level Security
- **Data & forms:** TanStack Query, React Hook Form, Zod
- **Charts & testing:** Recharts, Vitest, Testing Library

## 🚀 Quick start

```bash
git clone https://github.com/SimranDas005/BuySense.git
cd BuySense
npm install

cp .env.example .env
# Add your Supabase project values to .env

npm run dev
```

Open **http://localhost:8080**.

> `npm run dev` reads `.env` directly, so the file must exist before starting the dev server.

## 🔐 Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Public Supabase key |
| `VITE_SUPABASE_PROJECT_ID` | Browser | Supabase project reference |
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged operations — **never expose this to the browser** |
| `SUPABASE_PROJECT_ID` | Server | Supabase project reference |

## 🗄️ Database & auth notes

- **Supabase Auth is the only auth system.** Sessions are persistent JWTs.
- Roles live in `public.user_roles`; `public.has_role()` and `public.is_admin()` enforce access through Postgres RLS.
- Customer and admin areas are protected at both the route and database level.
- Cash-on-delivery checkout uses the existing `orders` and `order_items` tables. The server validates the user's token and role before writing with the service-role client.
- Add `http://localhost:8080/reset-password` and your production equivalent to Supabase's redirect allow-list for password-reset emails.
- **Do not run the full migrations directory against an existing database.** Review the targeted SQL first — some bundled migrations target a different role schema.

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

## 📁 Project layout

```text
src/
├── routes/          # Storefront, account, admin and auth pages
├── components/      # UI, product, cart, admin and DSS components
├── lib/
│   ├── dss/         # AHP, TOPSIS, criteria and decision engine
│   └── api/         # Server functions and data access
├── integrations/    # Supabase clients and auth middleware
└── hooks/           # Auth, shop and responsive helpers
supabase/            # Migrations and database setup SQL
```

## 🧭 Roadmap

See [roadmap.md](./roadmap.md) for what is shipped and what is next.

---

**BuySense** — because the best laptop is the one that fits *your* priorities.

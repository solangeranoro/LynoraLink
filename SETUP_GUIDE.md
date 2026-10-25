# LynoraLink — Setup, Run & Deployment Guide

**LynoraLink** — *Global Co-Building Hub for Indie Makers & Solopreneurs*
A bilingual (EN/FR) Next.js 14 application where makers partner in real time to build and launch micro-projects.

---

## 1. About the "403 Forbidden" error (root cause)

You reported a **403 Forbidden / 404** when opening the temporary preview link
(`https://022u6.app.super.myninja.ai`).

**Diagnosis performed:**

| Test | Result |
|------|--------|
| Local Next.js server (`http://localhost:3000/login`) | **200 OK** ✅ |
| Local register page | **200 OK** ✅ |
| Public exposed URL (`.../register`) | **302 → https://super.myninja.ai/404** ❌ |
| A **brand-new** simple static server on a **fresh port**, exposed the same way | **302 → /404** ❌ |

**Conclusion:** the app itself is healthy. The temporary **port-exposure edge (CloudFront)** in this
sandbox environment is not routing to the origin — *every* shortcode redirects to `/404`. This is an
**infrastructure issue of the temporary preview link**, not a bug in LynoraLink.

**Working alternative delivered:** the full UI is deployed as a **static showcase** to a reliable URL
(see section 6). The complete runnable Next.js source is in `lynoralink-source.zip`.

---

## 2. Prerequisites

- **Node.js ≥ 18.18** (Node 20 recommended)
- **npm** (or pnpm/yarn)
- A **PostgreSQL** database (local, Docker, or free **Neon** / **Supabase**)

---

## 3. Quick start (local)

```bash
# 1. Unzip the source
unzip lynoralink-source.zip -d lynoralink && cd lynoralink

# 2. Install dependencies
npm install

# 3. Configure local environment (PowerShell)
Copy-Item .env.example .env
Copy-Item .env.example .env.local
Copy-Item .env.example backend/.env.local

# 4. Start local Postgres and create an empty schema
npm run db:local:setup

# 5. Run frontend and API together
npm run dev
```

PostgreSQL 18 must be installed with `initdb`, `pg_ctl`, and `psql` on PATH. `npm run db:local:setup` creates a separate loopback-only cluster on port 5433 with an empty application schema. On Windows, the development commands automatically start that local database whenever `DATABASE_URL` points to port 5433, including after a PC restart; the database files and account records are retained when the application closes. Register a real account at `/register`; account records are stored through the backend API in PostgreSQL. The frontend proxies `/api/*` to `API_BACKEND_URL` (default `http://localhost:4000` locally). For production, set it to the deployed API URL and configure the API's PostgreSQL and email environment variables. Stop the local database with `npm run db:local:stop`.

To enable Google sign-in, create a Web OAuth client in Google Cloud Console, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI, and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env.local`. In production, register `https://YOUR_FRONTEND_DOMAIN/api/auth/callback/google` and set the same credentials on the API service. Keep `NEXTAUTH_URL` set to the frontend URL and use the same `NEXTAUTH_SECRET` on the frontend and backend; the frontend proxies the OAuth callback to the backend. Never expose the Google client secret in a `NEXT_PUBLIC_*` variable.

Production build:

```bash
npm run build && npm run start
```

---

## 4. Environment variables (`.env.local`)

```env
# --- Database (PostgreSQL / Neon) ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/lynoralink?schema=public&sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/lynoralink?schema=public&sslmode=require"

# --- NextAuth ---
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

# --- Paddle (clés privées : backend uniquement) ---
PADDLE_API_KEY=""
PADDLE_WEBHOOK_SECRET=""
# LynoAI Premium : 10 USD/mois, 120 USD/an.
PADDLE_COPILOT_PRICE_ID_MONTHLY=""
PADDLE_COPILOT_PRICE_ID_YEARLY=""
# Vérification vendeur : 15 USD/mois, 180 USD/an.
PADDLE_SELLER_VERIFICATION_PRICE_ID_MONTHLY=""
PADDLE_SELLER_VERIFICATION_PRICE_ID_YEARLY=""
PADDLE_ENVIRONMENT="sandbox"
# Activer les ventes Marketplace en production après approbation écrite de Paddle.
PADDLE_MARKETPLACE_APPROVED="false"

# --- Paddle.js (frontend; le client token est publiable) ---
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=""
NEXT_PUBLIC_PADDLE_ENVIRONMENT="sandbox"

# --- OAuth (optional) ---
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# --- AI Copilot (API only; configure at least one provider) ---
GROQ_API_KEY=""
GROQ_MODEL="llama-3.3-70b-versatile"
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_AI_API_TOKEN=""
CLOUDFLARE_AI_MODEL="@cf/meta/llama-3.1-8b-instruct"

# --- Email (optional locally; required in production) ---
# Configure Brevo:
BREVO_API_KEY=""
BREVO_FROM_EMAIL=""
BREVO_FROM_NAME="LynoraLink"
# Or use Resend:
RESEND_API_KEY=""
EMAIL_FROM="LynoraLink <no-reply@lynoralink.app>"
CONTACT_EMAIL=""

# --- App ---
NEXT_PUBLIC_APP_URL="http://localhost:3000"
API_BACKEND_URL="http://localhost:4000"

# --- Cloudinary (uploads signés sur l'API) ---
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

Keep `API_BACKEND_URL` in the root `.env.local` for the frontend. Put the database, OAuth, AI provider, email, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` variables in `backend/.env.local`; use the same auth secret in the frontend environment for middleware session checks. Groq is tried first and Cloudflare AI is used as fallback. The Copilot requires Premium access; its project, post and email actions require explicit confirmation, and listing moderation is admin-only.

Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the root `.env.local`. The API uses signed, authenticated Cloudinary uploads for avatars and attachments. Apply the updated database schema with `npm run db:push`, back up the database, then migrate existing attachment files with `npm run db:attachments:migrate`. The migration can be safely rerun after an interruption.

### Paiements

**LynoAI Premium.** Configurez dans Paddle deux prix récurrents : 10 USD/mois et 120 USD/an, puis renseignez `PADDLE_COPILOT_PRICE_ID_MONTHLY` et `PADDLE_COPILOT_PRICE_ID_YEARLY`. Le quota gratuit reste de 100 requêtes mensuelles par plateforme ; l’abonnement donne accès aux requêtes illimitées et les webhooks synchronisent les droits.

**Vérification vendeur.** Configurez dans Paddle les prix récurrents de 15 USD/mois et 180 USD/an, puis renseignez `PADDLE_SELLER_VERIFICATION_PRICE_ID_MONTHLY` et `PADDLE_SELLER_VERIFICATION_PRICE_ID_YEARLY`. Le vendeur soumet son profil, confirme l’adresse e-mail de son compte, puis choisit et paie un abonnement pour activer l’accès vendeur. La confirmation d’e-mail seule ne donne aucun droit de vente.

**Marketplace — Paddle, reversements manuels et commission nulle.** Les acheteurs règlent les annonces en USD via Paddle. La plateforme ne prélève aucune commission sur les ventes ; les frais de traitement Paddle peuvent s’appliquer. L’administration doit approuver les annonces. Aucun compte de paiement vendeur n’est demandé et aucun reversement automatique n’est déclenché : les vendeurs sont payés manuellement. Les prix Paddle des annonces sont créés à la première commande puis réutilisés. Les ventes et abonnements vendeurs en production restent désactivés tant que `PADDLE_MARKETPLACE_APPROVED` n’est pas explicitement à `true`. N’activez ce réglage qu’après approbation écrite par Paddle du modèle commercial et des reversements manuels ; vérifiez également ses exigences fiscales et contractuelles.

Les vendeurs déjà vérifiés avant l’introduction de l’abonnement ne sont pas automatiquement désactivés par cette configuration. Définissez une politique de transition avant de leur demander un abonnement ou de modifier leurs droits.

Configurez les événements `transaction.completed`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.paused`, `subscription.resumed` et `subscription.past_due` vers `/api/payments/paddle/webhook`. Placez les clés et identifiants de prix dans l’environnement backend ; `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` et `NEXT_PUBLIC_PADDLE_ENVIRONMENT` sont destinés à Paddle.js côté frontend.

Appliquez les migrations avec `npm run db:migrate` en développement ou `npx prisma migrate deploy --schema backend/prisma/schema.prisma` en production, puis régénérez le client Prisma. Les anciennes données Stripe/Connect restent dans la base pour l’historique, mais les nouveaux paiements utilisent Paddle. Sauvegardez la base avant le déploiement.

> If neither Brevo nor Resend is configured, password reset links are **logged to the API console**
> in local development. Configure one provider in production; otherwise reset requests return `503`.
>
> Set `CONTACT_EMAIL` in the API environment to receive messages submitted through the public contact form.

---

## 5. What's inside

### Design charter (Tailwind)
| Token | Value |
|-------|-------|
| Midnight (main bg) | `#13294B` |
| Deep (alt bg) | `#0B132B` |
| Card | `#1C2541` |
| Border | `#2A3655` |
| Gold (accent) | `#C5A059` |
| Gold bright | `#D4AF37` |
| Text | `#F8FAFC` / muted `#94A3B8` |

### Features implemented
- **SplashScreen** — centered circular logo, midnight bg, fade-out, gold loader (hydration + APK safe).
- **Skeletons** — `FeedSkeleton`, `SidebarSkeleton`, `ActiveMakersSkeleton` (`animate-pulse`).
- **i18n EN/FR** — lightweight Context provider, `messages/en.json` + `messages/fr.json`, discreet selector.
- **Prisma schema** — `User`, `Project`, `ProjectCollaborator`, `Post`, `Comment`, `Like`, `Conversation`, `Message`, `Huddle` (+ enums).
- **Auth (NextAuth)** — email/password with **verification** + **secure reset**, **Google** & **Facebook** OAuth.
- **Global Sidebar** — logo, translated tabs, language selector, gold **Create New Project** button.
- **Build in Public feed** — dynamic cards, avatar, role, project tag, like, **Join Team**.
- **Active Makers widget** — online creators with green dot + skeleton on load.

### Project structure
```
frontend/            # Next.js interface
  src/
    app/
      (auth)/    login · register · forgot-password · reset-password · verify
      (app)/     dashboard · projects · discover · messages · copilot · huddles · settings
      api/       proxy vers le backend
    components/  Sidebar · Feed · PostCard · ActiveMakers · SplashScreen · skeletons/* · auth/*
    lib/         i18n.tsx · utils.ts
  messages/     en.json · fr.json
  public/       assets statiques
backend/            # Backend Next.js indépendant
  src/app/api/   auth/* · projects/* · posts/* · makers · health
  src/lib/       auth · prisma · validators · email · utils
  prisma/         schema.prisma · migrations/ · seed.ts
package.json    # workspaces et commandes communes
```

---

## 6. Live static showcase (works now)

A pixel-accurate static preview of the UI (splash → login → register → dashboard) is deployed here:

**https://sites.super.myninja.ai/84702f3d-3af8-4e75-a1d8-6a179f14526d/aaebe031/index.html**

Use the top bar to switch between **Login / Register / Dashboard** and the **EN/FR** toggle.
(The source of this preview is in the `preview/` folder.)

---

## 7. Deployment

### Web — Vercel (recommended)
1. Push the repo to GitHub.
2. Import it in **Vercel** and set `frontend/` as the **Root Directory**.
3. Add `API_BACKEND_URL` with the public Render API URL and set `NEXTAUTH_URL` to the Vercel domain.
4. Set the same `NEXTAUTH_SECRET` on Vercel and Render; configure OAuth credentials on the API service.
4. Deploy. Vercel reads `frontend/vercel.json` from the configured root directory.

### API / DB — Render (optional)
- `render.yaml` deploys the `lynoralink-backend` workspace from the repository root. Set `NEXTAUTH_URL` to the frontend URL.
- Or use **Neon** for serverless Postgres and keep the API on Vercel.

### Android APK — Capacitor
```bash
npm run cap:build:android
```
Set `server.url` in `frontend/capacitor.config.ts` to the deployed frontend before syncing. Static export cannot forward API calls to the backend.

---

## 8. Real accounts

Create accounts through the registration page at `/register`. Registration, email verification, password reset, and sign-in use the backend API and the configured PostgreSQL database; there are no shared demo credentials or seeded users.

---

## 9. Health check

`GET /api/health` returns `{ ok: true }` when the database is reachable.
If you see `503`, it simply means no PostgreSQL is connected yet — add `DATABASE_URL` and re-run `npm run db:push`.

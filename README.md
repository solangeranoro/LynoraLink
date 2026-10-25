# LynoraLink — Global Co-Building Hub

> Le hub mondial de **co-building** pour Indie Makers & Solopreneurs.
> Les créateurs s'associent en temps réel pour bâtir et lancer des micro-projets.
> Le flux classique devient un flux **Build in Public**, et les pages entreprises deviennent des **Project Hubs** collaboratifs.

---

## 🗂️ Structure du dépôt

```text
.
├── backend/       API Next.js, routes, logique métier et schéma/migrations Prisma
├── frontend/      application web, ressources publiques, traductions et aperçu UI
├── scripts/       commandes partagées, dont le démarrage local
├── .vscode/       tâches de développement du workspace
├── .gitignore     exclusions des dépendances, secrets et fichiers générés
├── package.json   workspaces npm et commandes racine
└── package-lock.json
```

Les dossiers `node_modules/`, `.next*/` et `.local-postgres/` sont des dépendances,
caches de compilation ou données locales : ils ne font pas partie du code à publier.
La base locale est conservée sur la machine. Les fichiers `.env` restent locaux;
seul `.env.example` est destiné au dépôt. `LynoraCoding` et `showcase-site` sont
des projets séparés, rangés en dehors de ce dépôt.

---

## ✨ Stack technique

| Couche | Technologie |
| --- | --- |
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript |
| Styling | **Tailwind CSS** (charte sombre premium) |
| Base de données | **PostgreSQL** (Neon) + **Prisma ORM** |
| Auth | **NextAuth.js** — Credentials + Google OAuth + Facebook OAuth |
| Data client | **TanStack React Query** |
| i18n | Système léger EN/FR (App Router) |
| Paiements | **Paddle** (Copilot Premium et Marketplace) |
| Mobile | **Capacitor 7** → APK Android |
| Déploiement | **Vercel** (Web) + **Render** (API) |

---

## 🎨 Charte graphique

| Rôle | Couleur |
| --- | --- |
| Fond principal | `#13294B` / `#0B132B` |
| Accent doré | `#C5A059` / `#D4AF37` |
| Texte | `#FFFFFF` / `#F8FAFC` |
| Cartes | `#1C2541`, `rounded-xl`, bordures fines |

---

## 🚀 Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Préparer la configuration locale (Windows PowerShell)
Copy-Item .env.example .env
Copy-Item .env.example .env.local
Copy-Item .env.example backend/.env.local

# 3. Démarrer PostgreSQL local et créer le schéma vide
npm run db:local:setup

# 4. Lancer l'interface et l'API ensemble
npm run dev
```

`npm run db:local:setup` utilise les outils PostgreSQL locaux pour créer une base isolée sur le port 5433; PostgreSQL 18 doit être installé avec `initdb`, `pg_ctl` et `psql` accessibles dans le PATH. L'interface est disponible sur [http://localhost:3000](http://localhost:3000); elle relaie `/api/*` vers l'API backend sur le port 4000. Les inscriptions et connexions utilisent cette API et sont persistées dans PostgreSQL. En local, sans fournisseur email configuré, les liens de réinitialisation sont consignés dans la console de l'API. En production, configure `API_BACKEND_URL` avec l'URL publique de l'API, une base PostgreSQL réelle et Brevo ou Resend pour l'envoi des emails. Arrête la base locale avec `npm run db:local:stop`.

Sur Windows, `npm run dev`, `npm run dev:api` et `npm run dev:web` redémarrent automatiquement PostgreSQL quand `DATABASE_URL` pointe vers le port local `5433`. Les données de la base sont conservées après la fermeture de l'application ou le redémarrage du PC.

---

## 🚀 Déploiement en production (Vercel + Render)

Le dépôt est organisé en workspaces npm : le frontend et le backend doivent être
déployés comme deux projets distincts. Le fichier `render.yaml` déclare le
backend API et le serveur WebSocket de collaboration ; `frontend/vercel.json`
configure le projet Vercel.

### 1. Backend API et collaboration sur Render

1. Dans Render, crée un **Blueprint** depuis le dépôt GitHub et sélectionne
   `render.yaml`. Déploie les deux services `lynoralink-backend` et
   `lynoralink-collaboration` dans la même région.
2. Prépare une base PostgreSQL de production. Renseigne `DATABASE_URL` avec
   l'URL de connexion de l'application et `DIRECT_URL` avec l'URL directe
   recommandée par ton fournisseur (les migrations Prisma utilisent cette
   dernière). Ne réutilise pas la base PostgreSQL locale.
3. Dans les variables Render du backend, configure `NEXTAUTH_URL` et
   `NEXT_PUBLIC_APP_URL` avec l'URL publique du frontend Vercel, sans slash
   final. `NEXTAUTH_SECRET` est généré par le Blueprint ; copie exactement sa
   valeur dans `NEXTAUTH_SECRET` du service de collaboration.
4. Configure `BREVO_API_KEY` et `BREVO_FROM_EMAIL` : Brevo est nécessaire pour
   les codes de connexion et de vérification par e-mail. Ajoute aussi les
   identifiants OAuth, Cloudinary, Paddle et IA si ces fonctionnalités sont
   activées.
5. Après le premier déploiement, renseigne `CODING_WS_URL` dans le backend avec
   l'URL WebSocket publique du service Render de collaboration, en `wss://`.
   Cette fonctionnalité requiert les deux services actifs. Les commandes de
   terminal de l'IDE, qui démarrent des conteneurs Docker, ne sont pas prises
   en charge par un service Render Node standard.

Le Blueprint génère et applique les migrations Prisma avant le déploiement du
backend. Garde `PADDLE_ENVIRONMENT=sandbox` et
`PADDLE_MARKETPLACE_APPROVED=false` jusqu'à ce que Paddle ait approuvé la mise
en production et que les identifiants live soient configurés.

### 2. Frontend sur Vercel

1. Importe le même dépôt dans Vercel et choisis **`frontend` comme Root
   Directory**. Active l'option qui inclut les fichiers situés en dehors de ce
   répertoire : les workspaces npm et le lockfile sont à la racine du dépôt.
2. Laisse le framework Next.js détecté automatiquement. Le fichier
   `frontend/vercel.json` définit l'installation reproductible avec `npm ci`,
   la région et les en-têtes HTTP.
3. Ajoute la variable de production `API_BACKEND_URL` avec l'URL HTTPS publique
   du service `lynoralink-backend` sur Render, sans slash final, puis relance
   le déploiement. Le frontend transmet les requêtes `/api/*` au backend par
   cette URL.
4. Si Paddle est activé, configure aussi
   `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` et
   `NEXT_PUBLIC_PADDLE_ENVIRONMENT` dans Vercel.
5. Ajoute le domaine personnalisé dans Vercel, puis vérifie que
   `NEXTAUTH_URL` et `NEXT_PUBLIC_APP_URL` sur Render correspondent à ce
   domaine. Configure les URI de retour OAuth avec
   `https://<domaine>/api/auth/callback/google` et/ou
   `https://<domaine>/api/auth/callback/facebook`.

Les domaines publics Render peuvent différer selon le compte ou la région :
utilise dans les variables d'environnement les URL réellement affichées dans
les tableaux de bord Render et Vercel.

---

## 🗄️ Schéma de données (Prisma)

- **User** — profil maker : bio, skills[], liens GitHub/X, langue préférée, statut en ligne.
- **Project** — titre, tagline, description, statut (`IDEA` / `DEVELOPMENT` / `LAUNCHED`), dépôt GitHub, URL, logo, créateur.
- **ProjectCollaborator** — jointure User↔Project avec rôle (`FOUNDER`, `CO_BUILDER`, `DESIGNER`, `MARKETER`…) et statut (`PENDING`, `APPROVED`, `REJECTED`).
- **Post** — flux Build in Public : contenu, snippet de code, image, likes, commentaires, auteur, projet.
- **Comment / Like** — interactions sociales.
- **Conversation / Message** — messagerie.
- **Huddle** — sessions de co-building en temps réel.
- **Subscription / Boost / MarketplaceItem / LiveEvent** — abonnements, boosts, offres/commandes et réservations live; tarifs enregistrés en centimes.
- **Analytics / Matchmaking** — les analytics sont accessibles aux comptes vérifiés ou aux membres approuvés d’une équipe vérifiée; les recommandations de makers basées sur les compétences restent réservées aux comptes Premium.

### Monétisation

- LynoAI Copilote : 100 requêtes gratuites par mois et par plateforme (LynoraLink et LynoraCoding), renouvelées le 1er UTC. Le suivi d’utilisation reste disponible dans les analytics LynoAI.
- LynoAI Premium : 10 $ par mois ou 120 $ par an, géré par Paddle ; les webhooks activent et révoquent les quotas illimités.
- Le tableau de bord LynoAI présente le quota mensuel, la répartition par plateforme et une courbe quotidienne. Le suivi détaillé démarre à l’activation des événements d’usage ; les compteurs de quota conservent l’utilisation mensuelle existante.
- Comptes gratuits : jusqu’à 3 projets; Kanban et Copilote avancé réservés à Premium.
- Boost de projet : 5 USD pour 7 jours, affiché en tête de « Découvrir » pendant sa durée.
- Vérification vendeur : 15 $ par mois ou 180 $ par an via Paddle, après soumission du profil et confirmation de l’adresse e-mail.
- Marketplace : Paddle encaisse les paiements en USD ; la plateforme ne prélève aucune commission et verse manuellement les vendeurs. Les frais de traitement Paddle peuvent s’appliquer. Paddle doit approuver le modèle commercial avant sa mise en production.

---

## 🔐 Authentification

- **Email / mot de passe** : hash bcrypt, vérification email (token 24h), reset sécurisé (token 1h).
- **OAuth Google** et **OAuth Facebook** via NextAuth.
- **Toutes les connexions** exigent un code de sécurité à six chiffres envoyé par email.
- Config : `backend/src/lib/auth.ts` + `backend/src/app/api/auth/[...nextauth]/route.ts`.
- Pages : `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify`.

### Configurer les OAuth

**Google** — [console.cloud.google.com](https://console.cloud.google.com) → identifiants OAuth :
- URI de redirection locale : `http://localhost:3000/api/auth/callback/google`
- URI de redirection production : `https://VOTRE_DOMAINE/api/auth/callback/google`
- Configurer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans l'environnement du backend (`backend/.env.local` en local, variables du service API en production). L'URL reste sur le domaine frontend : le frontend relaie `/api/auth/*` vers le backend.

**Facebook** — [developers.facebook.com](https://developers.facebook.com) → Facebook Login :
- Dans **Paramètres de l'application → Général → Domaines de l'application**, ajouter `localhost`, `lynoralink.vercel.app` et `lynoralink.com` (noms d'hôte uniquement, sans `https://`, chemin ni port).
- Dans **Facebook Login → Paramètres**, activer **Connexion OAuth client** et **Connexion OAuth Web**, puis ajouter ces URI exactes aux URI de redirection OAuth valides :
- URI de redirection locale : `http://localhost:3000/api/auth/callback/facebook`
- URI de redirection production Vercel : `https://lynoralink.vercel.app/api/auth/callback/facebook`
- URI de redirection production domaine personnalisé : `https://lynoralink.com/api/auth/callback/facebook`
- L'API d'autorisation utilise Graph API `v25.0` et demande la permission standard `email`, nécessaire pour associer le compte à une adresse.
- La connexion Facebook ne demande pas le code 2FA LynoraLink. Le mot de passe Facebook est saisi uniquement sur le site de Facebook; LynoraLink ne le reçoit jamais. Facebook peut réutiliser une session existante : l'application ne peut pas imposer la saisie du mot de passe.
- Si Meta affiche `Invalid Scopes: email`, vérifiez que le produit **Facebook Login** est activé pour cette application et que la permission `email` est disponible dans son tableau de bord. Ne retirez pas cette permission : sans adresse email, l'inscription/connexion ne peut pas associer le compte.

---

## 🧩 Composants front-end clés

| Composant | Rôle |
| --- | --- |
| `SplashScreen.tsx` | Logo circulaire, fond bleu nuit, loader doré, fade-out |
| `Sidebar.tsx` | Nav globale traduite + sélecteur langue + bouton doré "Create New Project" |
| `Feed.tsx` / `PostCard.tsx` | Flux Build in Public + bouton "Join Team" |
| `ActiveMakers.tsx` | Widget makers en ligne (pastille verte) |
| `FeedSkeleton` / `SidebarSkeleton` / `ActiveMakersSkeleton` | États de chargement `animate-pulse` |
| `LanguageSwitcher.tsx` | Sélecteur EN/FR |
| LynoraCoding | IDE protégée par connexion via `/coding`; espaces personnels et espaces persistants par équipe, édition collaborative Yjs/Monaco, curseurs partagés, discussion d’équipe, rôles contributeur/observateur et historique de fichiers. |

LynoraCoding démarre dans un espace vide : aucun projet, compte, commit ou collaborateur de démonstration n’est injecté. Chaque fenêtre du navigateur possède son propre workspace personnel sauvegardé dans PostgreSQL. Choisissez une équipe dans la barre d’espace de travail pour ouvrir son workspace partagé; seuls le leader et les membres approuvés y ont accès. Les contributeurs peuvent modifier les fichiers, les observateurs sont en lecture seule. L’éditeur Monaco synchronise les changements et sélections par Yjs, conserve les changements localement avec IndexedDB en cas de coupure réseau, puis les persiste dans PostgreSQL. L’historique d’équipe est exposé via `/api/teams/:id/coding/history?filePath=...`; la discussion d’équipe est accessible depuis la barre supérieure. Appliquez les migrations avec `npx prisma migrate deploy --schema backend/prisma/schema.prisma` avant d’utiliser ces routes sur une base existante; `npm run db:push` reste prévu pour initialiser une base locale neuve.

Dans `/coding`, les paramètres sont enregistrés avec l’espace de travail. Le testeur API envoie de vraies requêtes depuis le navigateur; l’historique et les collections restent dans le stockage local du navigateur, et les identifiants d’authentification dédiés ne sont pas inclus dans ces sauvegardes. Le contrôle de version se connecte à GitHub ou GitLab.com avec un PAT conservé en mémoire seulement; il permet branches, historique, commits/push, pull et merge distants. Un push synchronise tout l’espace (et peut supprimer les fichiers distants absents de celui-ci) et un pull remplace tout l’espace : les deux demandent confirmation. Les conflits de merge doivent être résolus chez le fournisseur; les dépôts GitLab auto-hébergés ne sont pas pris en charge. Les appels API s’effectuent depuis le navigateur et dépendent de l’accès réseau/CORS du fournisseur.

Les extensions possédées et les extensions publiées utilisent les routes authentifiées `GET/POST /api/coding/extensions` et `PATCH/DELETE /api/coding/extensions/:id`. Les extensions exécutées sont confinées à une iframe sandboxée sans accès réseau; l’API développeur exposée est `api.getActiveFile()`, `api.replaceActiveFile(content)`, `api.notify(message)`, `api.on(event, callback)` et `api.registerCommand(name, callback)`. Les permissions requises sont affichées et demandées avant exécution.

Le débogueur intégré exécute uniquement du JavaScript dans une iframe isolée; les adaptateurs Python/C#, l’inspection complète des variables, l’exécution pas à pas et l’éditeur visuel de conflits ne sont pas fournis. Aucune de ces fonctions n’est présentée comme disponible.

---

## 🌍 Internationalisation

- Dictionnaires : `frontend/messages/en.json`, `frontend/messages/fr.json`.
- Provider : `frontend/src/lib/i18n.tsx` (`I18nProvider`, `useTranslation`).
- Persistance : `localStorage` + détection de la langue navigateur.

---

## ☁️ Déploiement

### Vercel (Web)
1. Importer le repo sur Vercel.
2. Définir `frontend/` comme répertoire racine du projet Vercel; le build est défini dans `frontend/vercel.json`.
3. Définir `API_BACKEND_URL` avec l'URL Render de l'API.
4. Définir `NEXTAUTH_SECRET` et `NEXTAUTH_URL` avec les mêmes valeurs que sur l'API, puis les identifiants OAuth.

### Render (API)
- Blueprint fourni : `render.yaml`; il construit et démarre le workspace `lynoralink-backend` depuis la racine du dépôt.
- Définir sur Render `NEXTAUTH_URL` comme URL du frontend, ainsi que les variables de base de données et d'authentification.

### Base de données
- Créer un projet **Neon** PostgreSQL, récupérer `DATABASE_URL` (pooler) et `DIRECT_URL` (direct).

---

## 📱 Android (APK via Capacitor)

```bash
# 1. Configurer server.url dans frontend/capacitor.config.ts avec l'URL Vercel
npm run build

# 2. Ajouter la plateforme Android
npm run cap:add:android

# 3. Synchroniser + ouvrir dans Android Studio
npm run cap:build:android
```

Puis dans Android Studio : **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

> L'export statique n'est pas compatible avec le proxy API; l'application mobile utilise donc la WebView distante Vercel.

---

## 📁 Arborescence

```
lynoralink/
├── frontend/                # Application Next.js, interface et routes proxy
│   ├── messages/            # Traductions EN / FR
│   ├── public/              # Ressources statiques
│   └── src/                 # Pages, composants et logique UI
├── backend/                 # API, authentification et données
│   ├── prisma/              # Schéma et migrations
│   └── src/                 # Endpoints REST et services métier
├── scripts/dev.mjs          # Lance les deux applications
├── package.json             # Scripts racine et workspaces npm
├── Dockerfile
└── render.yaml
```

---

## Terminal isolé de LynoraCoding

Le terminal fournit un shell Bash interactif avec PTY (programmes en plein écran, saisie continue, redimensionnement et `Ctrl+C`) dans un conteneur Docker isolé. Il nécessite un moteur Docker accessible par le processus backend ainsi que l’image dédiée, construite depuis la racine du dépôt :

```sh
docker build -f backend/docker/coding-terminal/Dockerfile -t lynoracoding-terminal:latest .
```

Le backend utilise `node-pty` pour gérer le PTY et `@xterm/xterm` dans l’éditeur pour l’affichage. Le shell tourne sans privilèges, sans réseau par défaut, avec des limites CPU/mémoire/processus. Les modifications sont synchronisées vers l’espace de travail lorsque le shell se ferme; les sauvegardes de l’éditeur sont suspendues tant qu’une session est active afin d’éviter les conflits. Une session inactive est fermée après 30 minutes; chaque compte peut ouvrir au plus quatre sessions simultanées. `LYNORACODING_DOCKER_COMMAND` (exécutable Docker, `docker` par défaut) et `LYNORACODING_TERMINAL_IMAGE` (image ci-dessus par défaut) peuvent être configurés. `LYNORACODING_TERMINAL_NETWORK=bridge` active le réseau pour installer des dépendances, mais autorise aussi le code exécuté à joindre des hôtes externes.

Le terminal intégré et les commandes ponctuelles utilisent uniquement Docker : si le moteur ou l’image est indisponible, l’API renvoie une erreur `503` au lieu de lancer une simulation.

Les sessions PTY résident en mémoire dans le processus backend; le service doit donc être persistant et les requêtes d’une session doivent atteindre la même instance. En équipe, les membres autorisés rejoignent le même terminal; seuls les leaders peuvent l’arrêter. Le déploiement multi-instance ou serverless nécessite un broker/worker de sessions dédié avant activation. En production, utiliser un moteur d’exécution dédié et rootless; ne pas exposer le socket Docker d’un hôte partagé à un service web public. Sans moteur ou image configurée, l’éditeur signale que le terminal isolé est indisponible.

Le serveur WebSocket Yjs est un service Node persistant séparé (`npm run start:collaboration --workspace lynoralink-backend`, port local `4001`). En production, déployer le service `lynoralink-collaboration` du blueprint et définir `CODING_WS_URL` sur l’API comme son URL publique `wss://...`. Définir le même `NEXTAUTH_SECRET` sur l’API et ce service : il signe et vérifie les tickets d’accès de courte durée. La route `/health` sert au contrôle de santé du service.

---

## 📜 Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Serveurs frontend (3000), API (4000) et collaboration WebSocket (4001) |
| `npm run db:local:setup` | PostgreSQL local et schéma vide |
| `npm run dev:web` | Serveur frontend uniquement |
| `npm run dev:api` | Serveur backend (port 4000) |
| `npm run start:collaboration --workspace lynoralink-backend` | Serveur WebSocket Yjs (port 4001 ou `PORT`) |
| `npm run build` | Build frontend |
| `npm run build:api` | Build backend |
| `npm run type-check` | Vérification TypeScript |
| `npm run db:push` | Sync schéma Prisma → DB |
| `npm run db:migrate` | Migrations Prisma |
| `npm run cap:build:android` | Build + sync Android |

---

© 2026 LynoraLink — Global Co-Building Hub. Built in public. 🚀

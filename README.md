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
| Base de données | **PostgreSQL** (Render en production) + **Prisma ORM** |
| Auth | **NextAuth.js** — Credentials + Google OAuth + Facebook OAuth |
| Data client | **TanStack React Query** |
| i18n | Système léger EN/FR (App Router) |
| Paiements | **Paddle** (Copilot Premium et boosts de projet) |
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
déployés comme deux projets distincts. Le backend API et le serveur WebSocket
de collaboration tournent dans le même service Render ; `frontend/vercel.json`
configure le projet Vercel.

### 1. Backend API et collaboration sur Render

Configure le service Web Render existant depuis son tableau de bord; `render.yaml`
est uniquement une option si tu choisis d'utiliser un Blueprint.

1. Depuis **Settings**, garde le répertoire racine du dépôt et configure le
   build avec `npm ci && npx prisma generate --schema backend/prisma/schema.prisma
   && npm run build --workspace lynoralink-backend`. Utilise
   `npm run start --workspace lynoralink-backend` comme commande de démarrage.
   Ce service lance l’API Next.js et les connexions WebSocket.
2. Dans **Environment** du service, configure `DATABASE_URL` et `DIRECT_URL`
   avec l'URL PostgreSQL Render. Si la base est dans la même région, préfère
   son URL interne; pour Render PostgreSQL, les deux variables peuvent utiliser
   la même URL. Ajoute aussi les variables d'authentification nécessaires :
   `NEXTAUTH_URL` et `NEXT_PUBLIC_APP_URL` avec l'URL publique du frontend,
   ainsi que `NEXTAUTH_SECRET`. Les fichiers `.env` locaux, ignorés par Git,
   ne sont pas transmis au service Render.
3. Configure `BREVO_API_KEY` et `BREVO_FROM_EMAIL` pour les codes de connexion
   et de vérification par e-mail. Ajoute les identifiants OAuth, Cloudinary,
   Paddle, IA et Firebase si les fonctionnalités correspondantes sont activées.
4. Configure `CODING_WS_URL` et `CO_BUILDING_WS_URL` avec l'URL publique WSS
   de ce service, par exemple `wss://api.lynoralink.com` et
   `wss://api.lynoralink.com/co-building`; remplace le domaine par celui du
   service si nécessaire.
5. Applique les migrations Prisma avant d'utiliser la nouvelle base, avec
   `npx prisma migrate deploy --schema backend/prisma/schema.prisma`. Tu peux
   définir cette commande comme **Pre-Deploy Command** si elle est disponible
   pour ton service, ou l'exécuter depuis le Shell Render.

Avant le démarrage du backend avec une base neuve ou modifiée, applique les
migrations Prisma. Configure Paddle uniquement pour les fonctions qui l’utilisent,
comme Copilot Premium et les boosts. Le Marketplace ne traite aucun paiement via
Paddle : acheteurs et vendeurs négocient et concluent leurs transactions
directement.

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

### 3. Firebase Cloud Messaging et WebSocket sécurisé

**Notifications push Firebase**

1. Dans Firebase Console, crée un projet, ajoute une application Web, puis
   active **Cloud Messaging**. Renseigne les six valeurs de configuration de
   l'application Web et la clé Web Push (VAPID) dans les variables Vercel
   `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
   et `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
2. Crée un compte de service Firebase avec l'autorisation d'envoyer des
   messages Firebase Cloud Messaging. Dans Render, ajoute le JSON complet de
   cette clé à `FIREBASE_SERVICE_ACCOUNT_JSON` du service API uniquement.
   Cette clé est secrète : ne l'ajoute ni au frontend, ni au dépôt, ni à un
   fichier `.env` suivi par Git.
3. Configure dans Firebase les domaines autorisés correspondant au domaine
   Vercel et à tout domaine personnalisé. Redéploie le frontend après avoir
   ajouté les variables `NEXT_PUBLIC_*` : l'application sert le service worker
   `/firebase-messaging-sw.js` avec cette configuration.
4. Applique les migrations Prisma du déploiement. Chaque membre peut ensuite
   activer les notifications de son navigateur dans **Paramètres → Notifications**.
   Les préférences de notifications du compte sont également respectées.

**WebSocket en production**

Le backend Render démarre Next.js et le serveur de collaboration sur le même
port et prend en charge TLS/WSS sur son URL publique. `CODING_WS_URL` doit
contenir cette URL en `wss://`; `CO_BUILDING_WS_URL` reprend le même hôte avec
le chemin `/co-building`. Configure `NEXT_PUBLIC_APP_URL` avec l'origine exacte
du frontend. En production, les sessions de coédition refusent les URL `ws://`
et les origines navigateur qui ne correspondent pas à cette configuration.
Pour une application mobile Capacitor ou un domaine frontend supplémentaire,
ajoute ses origines exactes, séparées par des virgules, dans
`WSS_ALLOWED_ORIGINS` du service backend.

**Chiffrement des messages**

Les nouveaux messages et pièces jointes sont chiffrés par le backend avec
AES-256-GCM avant leur enregistrement. Configure `MESSAGE_ENCRYPTION_KEY` dans
l'environnement du backend avec une clé aléatoire base64 de 32 octets; génère-la
avec `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
La clé est obligatoire pour créer des messages et lire les données chiffrées
version 2. En cas de clé absente ou invalide, les API échouent explicitement et
n'enregistrent jamais de texte ou de fichier en clair. Garde une sauvegarde
sécurisée de cette clé : la perdre, ou la remplacer, rend les messages version 2
irrécupérables.

Le backend ne renvoie le texte et les métadonnées déchiffrés qu'aux membres
authentifiés de la conversation. Les octets envoyés à Cloudinary sont chiffrés;
les noms, types MIME et tailles des pièces jointes sont également chiffrés en
base. Le texte en clair est visible par le serveur pendant le traitement et
pour les appels API autorisés : ce modèle n'est pas du chiffrement de bout en
bout.

Les messages existants `encryptionVersion=1` restent inchangés : leurs
chiffrements client et `keyEnvelopes` ne sont ni réécrits ni migrés, et les
routes E2EE historiques restent disponibles pour eux. Les anciens messages sans
version gardent leur comportement. Le chiffrement version 2 réutilise les
colonnes existantes; aucune migration de schéma n'est nécessaire.

---

## 🗄️ Schéma de données (Prisma)

- **User** — profil maker : bio, skills[], liens GitHub/X, langue préférée, statut en ligne.
- **Project** — titre, tagline, description, statut (`IDEA` / `DEVELOPMENT` / `LAUNCHED`), dépôt GitHub, URL, logo, créateur.
- **ProjectCollaborator** — jointure User↔Project avec rôle (`FOUNDER`, `CO_BUILDER`, `DESIGNER`, `MARKETER`…) et statut (`PENDING`, `APPROVED`, `REJECTED`).
- **Post** — flux Build in Public : contenu, snippet de code, image, likes, commentaires, auteur, projet.
- **Comment / Like** — interactions sociales.
- **Conversation / Message** — messagerie.
- **Huddle** — sessions de co-building en temps réel.
- **Subscription / Boost / MarketplaceItem / LiveEvent** — abonnements, boosts, offres Marketplace et réservations live; les ventes Marketplace sont négociées directement entre membres.
- **Analytics / Matchmaking** — les analytics sont accessibles aux comptes vérifiés ou aux membres approuvés d’une équipe vérifiée; les recommandations de makers basées sur les compétences restent réservées aux comptes Premium.

### Monétisation

- LynoAI Copilote : 100 requêtes gratuites par mois et par plateforme (LynoraLink et LynoraCoding), renouvelées le 1er UTC. Le suivi d’utilisation reste disponible dans les analytics LynoAI.
- LynoAI Premium : 10 $ par mois ou 120 $ par an, géré par Paddle ; les webhooks activent et révoquent les quotas illimités.
- Le tableau de bord LynoAI présente le quota mensuel, la répartition par plateforme et une courbe quotidienne. Le suivi détaillé démarre à l’activation des événements d’usage ; les compteurs de quota conservent l’utilisation mensuelle existante.
- Comptes gratuits : jusqu’à 3 projets; Kanban et Copilote avancé réservés à Premium.
- Boost de projet : 5 USD pour 7 jours, affiché en tête de « Découvrir » pendant sa durée.
- Vérification du compte vendeur : gratuite et obligatoire pour publier une offre; elle comprend la soumission du profil et la confirmation de l’adresse e-mail.
- Marketplace : le prix est indicatif. L’acheteur contacte le vendeur pour négocier et conclure la vente directement; LynoraLink ne traite ni paiement ni livraison et ne nécessite aucune configuration Paddle.

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
- La connexion Facebook demande une réauthentification Meta et ne demande pas le code 2FA LynoraLink. Le mot de passe Facebook, s'il est demandé, est saisi uniquement sur le site de Facebook; LynoraLink ne le reçoit jamais. Facebook peut choisir une passkey, une validation à deux facteurs ou réutiliser une session : l'application ne peut pas imposer un mot de passe.
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
   Le `postinstall` racine saute la génération Prisma sur Vercel; le service API Render la génère pendant son build.

### Render (API)
- Le service peut être configuré depuis le tableau de bord Render; `render.yaml`
  décrit une configuration Blueprint facultative.
- Définir sur Render `NEXTAUTH_URL` comme URL du frontend, ainsi que les
  variables de base de données et d'authentification.

### Base de données
- En production sur Render, utiliser l'URL interne de la base PostgreSQL Render
  dans `DATABASE_URL` et `DIRECT_URL` du service backend. Appliquer les
  migrations Prisma avant d'utiliser la base.

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

En production, le serveur WebSocket Yjs partage le processus et le port HTTP du backend (`npm run start --workspace lynoralink-backend`). En développement, il reste lancé séparément par `npm run dev` sur le port local `4001`.

---

## 📜 Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Serveurs frontend (3000), API (4000) et collaboration WebSocket (4001) |
| `npm run db:local:setup` | PostgreSQL local et schéma vide |
| `npm run dev:web` | Serveur frontend uniquement |
| `npm run dev:api` | Serveur backend (port 4000) |
| `npm run start --workspace lynoralink-backend` | Backend Next.js et WebSocket intégrés (port `PORT`) |
| `npm run start:collaboration --workspace lynoralink-backend` | Serveur WebSocket seul (port 4001 ou `PORT`) |
| `npm run build` | Build frontend |
| `npm run build:api` | Build backend |
| `npm run type-check` | Vérification TypeScript |
| `npm run db:push` | Sync schéma Prisma → DB |
| `npm run db:migrate` | Migrations Prisma |
| `npm run cap:build:android` | Build + sync Android |

---

© 2026 LynoraLink — Global Co-Building Hub. Built in public.

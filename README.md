# QR Platform — QR codes dynamiques & marketing auto-hébergés (MINGGLE)

Plateforme complète, open source et auto-hébergée, pour faire croître la marque
MINGGLE : **QR codes intelligents** et **liens de suivi** (redirection
automatique App Store / Google Play, statistiques temps réel, RGPD),
**posts marketing** publiés sur le site et relayés aux réseaux sociaux, et
**IA intégrée** (Claude) pour générer le contenu et analyser l'audience —
jusqu'au mode **autopilote** hebdomadaire.
Aucune dépendance à un service QR payant : le QR code fonctionne tant que votre
domaine existe.

## Sommaire

1. [Architecture](#architecture)
2. [Choix techniques](#choix-techniques)
3. [Coûts](#coûts)
4. [Démarrage rapide](#démarrage-rapide)
5. [Déploiement](#déploiement)
6. [Fonctionnement détaillé](#fonctionnement-détaillé)
7. [RGPD](#rgpd)
8. [Suivi des conversions](#suivi-des-conversions)

---

## Architecture

```
                        ┌────────────────────────────────────────────┐
  Flyer / affiche       │            Next.js (full-stack)            │
  ┌──────────┐          │                                            │
  │ QR code  │  scan    │  /r/{slug}  ── détection appareil ──┐      │
  │ /r/flyer │ ───────► │  /download     (User-Agent)         │      │
  └──────────┘          │                                     ▼      │
                        │   iPhone/iPad ──► App Store                │
                        │   Android     ──► Google Play              │
                        │   Autres      ──► page web (/app ou URL)   │
                        │                                            │
                        │   tracking asynchrone (après réponse) :    │
                        │   IP anonymisée + géoloc ville/pays        │
                        │                    │                       │
                        │                    ▼                       │
                        │   /admin  ◄──  PostgreSQL (Prisma)         │
                        │   tableau de bord, QR codes, exports       │
                        └────────────────────────────────────────────┘
```

- **Une seule application Next.js** (App Router) porte tout : la redirection
  publique, l'API sécurisée et le tableau de bord. Un seul déploiement, zéro
  service annexe obligatoire.
- **Le QR code encode une URL de votre domaine** (`https://monsite.com/r/flyer-paris`).
  Les destinations (App Store, Google Play, page web) sont stockées en base et
  modifiables dans l'admin : **le QR imprimé ne change jamais**.
- **Le tracking n'ajoute aucune latence au scan** : l'enregistrement (et la
  géolocalisation) s'exécutent *après* l'envoi de la redirection
  (`after()` de Next.js).
- **Redirection en HTTP 302** (jamais 301) : les navigateurs ne mettent pas en
  cache la destination, vos modifications de liens sont immédiates.

### Structure du code

```
prisma/schema.prisma          Modèles : QrCode, ScanEvent, Conversion
src/
  middleware.ts               Protection de /admin et /api/admin (session JWT)
  lib/
    redirect.ts               Cœur : détection + redirection + tracking différé
    detect.ts                 Appareil / OS / navigateur / bots (sans dépendance)
    geo.ts                    Géoloc : en-têtes Vercel/Cloudflare → ip-api.com
    ip.ts                     Extraction + anonymisation IP (RGPD)
    auth.ts                   Sessions signées (jose / JWT HS256)
  app/
    r/[slug]/route.ts         Endpoint scanné par les QR codes
    download/route.ts         Alias : QR par défaut (slug "download")
    app/page.tsx              Page de présentation (repli desktop)
    privacy/page.tsx          Politique de confidentialité
    admin/…                   Tableau de bord, gestion des QR, RGPD
    api/admin/…               stats, scans, export CSV, purge, CRUD QR
    api/convert/route.ts      Conversions post-installation (public)
  components/                 Graphiques (Recharts), carte monde, QR designer
```

## Choix techniques

| Brique | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15** (React 19) | Frontend + API + middleware dans un seul projet ; déployable gratuitement sur Vercel ou en Docker n'importe où |
| Base de données | **PostgreSQL** + **Prisma** | Standard, gratuit (Neon/Supabase/Docker) ; Prisma = schéma versionné + requêtes typées |
| QR code | **`qrcode`** (npm, MIT) | Génération PNG *et* SVG, niveau de correction H (30 %) pour tolérer un logo central ; tout se passe dans le navigateur, aucun service externe |
| Détection d'appareil | Analyse du User-Agent **maison** (~60 lignes) | Besoin simple (iPhone/iPad/Android/Windows/Mac) ; zéro dépendance, détecte aussi les navigateurs in-app (Instagram, TikTok…) = source de trafic |
| Géolocalisation | En-têtes **Vercel/Cloudflare** puis **ip-api.com** | Les en-têtes sont gratuits et instantanés ; ip-api.com est gratuit (45 req/min) en secours. Désactivable (`GEOIP_DISABLED=1`) — la redirection ne dépend **jamais** de la géoloc |
| Auth admin | Mot de passe + **JWT signé** (jose) en cookie httpOnly | Un seul administrateur : pas besoin d'une usine à gaz type NextAuth ; comparaison à temps constant |
| Graphiques | **Recharts** | Open source, léger, rendu SVG accessible |
| Carte | **TopoJSON auto-hébergé** (`public/world-110m.json`) | Carte du monde sans CDN ni service de tuiles : fonctionne hors ligne |

## Coûts

| Poste | Option gratuite | Option payante (facultative) |
|---|---|---|
| Hébergement app | **Vercel Hobby** (gratuit) ou VPS existant via Docker | Vercel Pro 20 $/mois si gros trafic |
| Base PostgreSQL | **Neon** ou **Supabase** free tier (~0,5 Go ≈ des millions de scans) | Neon Launch 19 $/mois |
| Géolocalisation | En-têtes Vercel/CF (inclus) + ip-api.com (45 req/min) | MaxMind GeoIP2 ou ipinfo si volume énorme |
| Nom de domaine | — | **~10 €/an** (seul coût réellement obligatoire) |
| Librairies | 100 % open source (MIT/Apache) | — |

**Total minimal : le prix de votre nom de domaine.** Important : le domaine est
le seul point de permanence du système — tant qu'il vous appartient, tous les
QR codes imprimés restent valides.

## Démarrage rapide

```bash
# 1. Dépendances
npm install

# 2. Configuration
cp .env.example .env
#    → renseigner DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
#    SESSION_SECRET : openssl rand -hex 32

# 3. Base de données locale (option Docker)
docker compose up -d db
npx prisma db push

# 4. Lancer
npm run dev
```

- Admin : http://localhost:3000/admin
- QR par défaut : http://localhost:3000/download (créé automatiquement au 1er scan)

## Déploiement

### Option A — Vercel + Neon (100 % gratuit)

1. Créez une base sur [neon.tech](https://neon.tech) (gratuit), copiez l'URL de connexion.
2. Importez ce dépôt sur [vercel.com](https://vercel.com), ajoutez les variables
   d'environnement : `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `APP_BASE_URL`.
3. Appliquez le schéma : `DATABASE_URL="postgres://…" npx prisma db push` (une fois, depuis votre machine).
4. Pointez votre domaine sur le projet Vercel.

Bonus : sur Vercel, la géolocalisation (pays, ville, coordonnées) est fournie
par les en-têtes de la plateforme — aucun appel externe.

### Option B — Docker sur un VPS

```bash
ADMIN_PASSWORD=… SESSION_SECRET=… APP_BASE_URL=https://monsite.com docker compose up -d --build
```

L'application écoute sur le port 3000 ; placez un reverse proxy (Caddy, nginx,
Traefik) devant pour le HTTPS. Le schéma de base est appliqué automatiquement
au démarrage du conteneur.

## Fonctionnement détaillé

### Créer un QR code de campagne

1. Admin → « QR codes » → nom (ex. *Flyer Paris*) → **Créer**.
2. Ouvrez la campagne, renseignez les liens App Store / Google Play.
3. (Optionnel) Ajoutez votre logo au centre.
4. Téléchargez le **PNG** (2048 px, ~17 cm à 300 dpi) ou le **SVG** (vectoriel,
   idéal imprimeur) et placez-le sur votre support.

Chaque campagne a sa propre URL (`/r/flyer-paris`, `/r/salon`, `/r/instagram`)
et ses statistiques comparées sur le tableau de bord.

### Données enregistrées à chaque scan

Date/heure, QR code scanné, type d'appareil (iPhone, iPad, Android, Windows,
Mac, Linux, autre), OS + version, navigateur (y compris in-app Instagram/
Facebook/TikTok), langue de l'appareil, pays, ville, coordonnées arrondies
(~11 km), IP **anonymisée**, source de trafic (`?utm_source=` ou référent) et
destination de la redirection. Les bots (aperçus WhatsApp, crawlers…) sont
redirigés mais **pas comptés**.

### Tableau de bord

Total / aujourd'hui / période, évolution par jour (empilée iPhone/Android/
autres), répartition des appareils, carte du monde des villes, top pays et
villes, comparaison des campagnes avec taux de conversion, **derniers scans en
direct** (rafraîchis toutes les 5 s), **export CSV** (compatible Excel FR).

## RGPD

- **Anonymisation à la source** : l'IP complète n'est jamais stockée
  (dernier octet supprimé ; IPv6 tronquée à /48). Elle ne sert, en mémoire,
  qu'à la géolocalisation approximative.
- **Pas de cookies** côté visiteur scannant, pas d'identifiant persistant.
- **Politique de confidentialité** publique incluse : `/privacy` (à personnaliser).
- **Droit à l'effacement** : Admin → RGPD → purge par ancienneté ou totale ;
  suppression d'un QR code = suppression en cascade de ses scans.
- **Rétention automatique** : `RETENTION_DAYS=395` purge les scans trop vieux.

## Liens de suivi

Même moteur que les QR codes, sans l'image : une campagne de type « Lien »
donne une URL `https://monsite.com/l/{slug}` à placer en bio Instagram, story,
e-mail, signature… Détection d'appareil, redirection intelligente et tracking
identiques. Ajoutez `?utm_source=story` pour distinguer les placements — la
source apparaît dans le tableau de bord et l'export CSV. Chaque campagne porte
un **canal** (instagram, flyer, email…) pour comparer les performances.

## Posts marketing & IA (Claude)

- **Posts** : rédigez (ou générez) des posts en markdown dans l'admin ; publiés,
  ils apparaissent sur la page publique `/news` avec un bouton de
  téléchargement **tracké** (attribution par campagne).
- **Génération par Claude** (`ANTHROPIC_API_KEY` requise) : bouton « Générer un
  brouillon » — Claude s'appuie sur vos statistiques réelles (appareils,
  canaux, villes, conversions) et vos posts existants pour rédiger un contenu
  original. Toujours relire avant de publier.
- **Analyse IA de l'audience** : sur le tableau de bord, Claude croise toutes
  les données et rend une analyse actionnable (ce qui marche / ne marche pas /
  3-5 recommandations priorisées).
- Coût : facturation Anthropic à l'usage — de l'ordre de quelques centimes par
  post/analyse avec le modèle par défaut (`claude-opus-4-8`, modifiable via
  `AI_MODEL`).

### Publication automatique sur les réseaux sociaux

Les API d'Instagram/TikTok/Facebook exigent des comptes business et des
validations d'application : la voie pragmatique et gratuite est un **webhook**.
À chaque publication de post, la plateforme envoie un POST JSON
(titre, accroche, contenu, hashtags, URL) vers `SOCIAL_WEBHOOK_URL`.
Branchez-y :

- **Make** (gratuit jusqu'à 1 000 opérations/mois) ou **Zapier** : scénario
  « Webhook → publier sur Instagram/Facebook/LinkedIn/X » ;
- ou **Buffer** (plan gratuit) via leur intégration Zapier.

Une fois le scénario configuré, chaque post publié sur `/news` part
automatiquement sur vos réseaux — zéro action manuelle.

### Autopilote marketing

Avec `AUTOPILOT=1` + `ANTHROPIC_API_KEY` (+ `SOCIAL_WEBHOOK_URL` pour le relais
réseaux), le cron Vercel (`vercel.json`, chaque lundi 9 h UTC) fait tout seul :
Claude analyse les 30 derniers jours de données → rédige un post original →
le publie sur `/news` → le relaie aux réseaux via le webhook. Ajustez la
fréquence dans `vercel.json` (le plan Hobby autorise au plus un déclenchement
quotidien). Protégez l'endpoint avec `CRON_SECRET` (envoyé automatiquement par
Vercel en en-tête `Authorization`).

## Suivi des conversions

Endpoint public (aucune donnée personnelle) à appeler depuis votre app mobile
au premier lancement :

```
GET https://monsite.com/api/convert?qr=flyer-paris&platform=ios
```

Pour attribuer l'installation à la bonne campagne, deux stratégies :

1. **Simple (approximative)** : appeler l'endpoint sans slug de campagne précis
   (ou avec un slug générique) — vous obtenez le volume global d'installations.
2. **Précise** : utiliser un lien de store avec paramètre
   (`&referrer=utm_source%3Dflyer-paris` sur Google Play, récupérable via
   l'API Install Referrer d'Android) et passer ce slug à `/api/convert`.
   Sur iOS, l'App Store ne transmet pas de référent : l'attribution fine
   nécessite un outil dédié (ex. AppsFlyer) ou se contente du volume global.

Le taux de conversion (installations / scans) apparaît dans le tableau de
comparaison des campagnes.

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Connexion PostgreSQL |
| `ADMIN_PASSWORD` | ✅ | Mot de passe de l'admin |
| `SESSION_SECRET` | ✅ | Secret de signature des sessions (≥ 16 caractères) |
| `APP_BASE_URL` | recommandé | Domaine public (affichage/encodage des QR) |
| `NEXT_PUBLIC_APP_BASE_URL` | non | Force le domaine encodé dans les QR côté admin |
| `GEOIP_DISABLED` | non | `1` = aucun appel à ip-api.com |
| `RETENTION_DAYS` | non | Purge automatique des scans plus vieux que N jours |
| `DASHBOARD_TZ` | non | Fuseau du tableau de bord (défaut `Europe/Paris`) |
| `ANTHROPIC_API_KEY` | non | Active la génération de posts et l'analyse IA (console.anthropic.com) |
| `AI_MODEL` | non | Modèle Claude (défaut `claude-opus-4-8`) |
| `IMAGE_API_KEY` | non | Active la génération de **vraies images** par IA (bouton « ✨ Générer une image ») — fournisseur compatible OpenAI Images |
| `IMAGE_API_URL` / `IMAGE_API_MODEL` / `IMAGE_API_SIZE` | non | Endpoint / modèle / taille du fournisseur d'images (défauts OpenAI Images) |
| `SOCIAL_WEBHOOK_URL` | non | Webhook Zapier/Make/Buffer appelé à chaque publication de post |
| `AUTOPILOT` | non | `1` = post hebdomadaire 100 % automatique (cron Vercel) |
| `CRON_SECRET` | non | Protège l'endpoint `/api/cron/autopilot` |

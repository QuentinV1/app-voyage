# 🛠️ Guide de mise en place (≈ 20 min, à faire une seule fois)

Tout se fait dans **un seul projet Google** (Firebase = Google Cloud).

## 1. Créer le projet Firebase
1. Aller sur https://console.firebase.google.com → **Créer un projet** (ex. `voyage-japon`). Google Analytics : inutile, désactive-le.
2. Page d'accueil du projet → icône **`</>` (Web)** → nom `Voyage Japon` → **ne pas** cocher Hosting ici → Enregistrer.
3. Copier les valeurs de `firebaseConfig` affichées.
4. Dans le dossier du projet : copier `.env.example` en **`.env.local`** et coller les valeurs `VITE_FIREBASE_*`.

## 2. Authentification Google
**Build → Authentication → Commencer → Google → Activer** → choisir ton e-mail d'assistance → Enregistrer.

## 3. Base de données Firestore
1. **Build → Firestore Database → Créer une base de données**.
2. Emplacement : `eur3 (europe)` ou `europe-west9 (Paris)`. Mode : **production**.
3. Onglet **Règles** : remplacer le contenu par celui du fichier [`firestore.rules`](firestore.rules) → **Publier**.
   *(ou plus tard en ligne de commande : `npx firebase-tools deploy --only firestore:rules`)*

## 4. Gemini (Firebase AI Logic) — gratuit
**Build → AI Logic → Commencer → choisir « Gemini Developer API »** (free tier, pas de facturation requise).

## 5. Google Maps & Places
1. Aller sur https://console.cloud.google.com et **sélectionner le même projet** (`voyage-japon`).
2. **Facturation** → associer un compte de facturation (carte bancaire requise, rien n'est débité dans les quotas gratuits).
3. **API et services → Bibliothèque** → activer :
   - **Maps JavaScript API**
   - **Places API (New)**
4. **API et services → Identifiants → Créer des identifiants → Clé API**, puis **Modifier la clé** :
   - *Restrictions d'application* : **Sites Web** → ajouter `http://localhost:5173/*`, `https://VOTRE-PROJET.web.app/*`, `https://VOTRE-PROJET.firebaseapp.com/*`
   - *Restrictions d'API* : Maps JavaScript API + Places API (New)
5. Coller la clé dans `.env.local` → `VITE_GOOGLE_MAPS_API_KEY`.
6. *(Optionnel)* **Google Maps Platform → Gestion des cartes → Créer un ID de carte** (JavaScript, vectoriel) → `VITE_GOOGLE_MAPS_MAP_ID`. Sinon `DEMO_MAP_ID` fonctionne pour commencer.

### 🛡️ Garde-fous anti-facture (fortement recommandé)
- **Facturation → Budgets et alertes** → budget de **1 €** avec alertes à 50 / 90 / 100 %.
- **API et services → Places API (New) → Quotas** → plafonner par jour, par ex. :
  - Autocomplete : 300 / jour
  - Place Details : 300 / jour
  - Text Search : 300 / jour
- **Maps JavaScript API → Quotas** → Map loads : 500 / jour.

Pour 6 personnes, ces plafonds sont très confortables et garantissent de rester dans le gratuit.

## 6. Lancer en local
```powershell
npm.cmd install
npm.cmd run dev
```
Ouvrir http://localhost:5173, se connecter avec Google, créer le voyage, ajouter les e-mails des 5 autres voyageurs.

> ℹ️ Sous PowerShell, utiliser `npm.cmd` (ou autoriser les scripts : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).

## 7. Mettre en ligne (Firebase Hosting, gratuit)
```powershell
npx -y firebase-tools login
npx -y firebase-tools use --add      # choisir le projet voyage-japon
npm.cmd run deploy
```
L'app est alors disponible sur **https://VOTRE-PROJET.web.app** → c'est ce lien que tu partages.

## 8. Installer sur les téléphones
- **iPhone** : ouvrir le lien dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
- **Android** : ouvrir le lien dans **Chrome** → menu **⋮** → **Installer l'application**.

## Dépannage
| Problème | Solution |
|---|---|
| « Missing or insufficient permissions » | Règles Firestore non publiées (étape 3.3) ou e-mail absent des voyageurs |
| Connexion Google bloquée sur iPhone (app installée) | Mettre `VITE_FIREBASE_AUTH_DOMAIN=VOTRE-PROJET.web.app` puis redéployer |
| Recherche de lieux vide / `RefererNotAllowedMapError` | Vérifier les restrictions de la clé Maps (étape 5.4) |
| Erreur IA « model not found » | Changer `VITE_GEMINI_MODEL` (voir les modèles disponibles dans la console AI Logic) |

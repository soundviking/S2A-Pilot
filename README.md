# ShowCue by S2A Production

**ShowCue** est un outil de conduite de spectacle conçu pour préparer des TOPS précisément synchronisés à un média audio ou vidéo.

Le projet regroupe deux applications complémentaires :

- **ShowCue PWA V1.1.16** : application autonome et installable pour iPad, Mac, PC et Android.
- **ShowCue for QLab V1.1** : application macOS permettant d'intégrer une conduite ShowCue dans **QLab 5**.

L'objectif est de pouvoir préparer une conduite simplement, l'exploiter directement avec ShowCue ou la transférer vers QLab selon les besoins du spectacle.

---

## Fonctionnement général

Le workflow principal est :

```text
Média audio ou vidéo
        ↓
Création des TOPS dans ShowCue
        ↓
Ajout éventuel de visuels aux TOPS
        ↓
Test et exploitation en mode Show
        ↓
Export du projet .showcue.zip
        ↓
Sauvegarde / transfert vers une autre machine
        ↓
Import possible dans ShowCue for QLab
        ↓
Création de la conduite dans QLab 5
```

---

# 1. ShowCue PWA — V1.1.16

La PWA constitue la version autonome de ShowCue.

Elle fonctionne dans un navigateur compatible et peut être installée comme une application. Une fois les ressources nécessaires mises en cache, elle est conçue pour pouvoir être utilisée hors ligne.

## Fonctions principales

- chargement d'un **média audio ou vidéo** ;
- lecture, pause et déplacement dans le média ;
- création de **TOPS horodatés** ;
- modification précise du temps d'un TOP ;
- déplacement des TOPS sur la timeline ;
- titre du spectacle / de la conduite ;
- ajout facultatif d'une image à un TOP ;
- affichage du **prochain TOP** ;
- mode **Édition** pour préparer la conduite ;
- mode **Show** pour l'exploitation ;
- monitor vidéo intégré lorsqu'un fichier vidéo est utilisé ;
- sortie vidéo externe sur les plateformes compatibles ;
- sauvegarde automatique locale ;
- export et réouverture d'un projet complet au format `.showcue.zip`.

## Mode Édition

Le mode Édition permet de construire la conduite.

1. Choisir un média audio ou vidéo.
2. Lire le média ou se positionner au moment souhaité.
3. Ajouter un TOP.
4. Nommer et ajuster le TOP si nécessaire.
5. Ajouter éventuellement un visuel.
6. Répéter l'opération pour l'ensemble de la conduite.

Les marqueurs de la timeline peuvent être déplacés afin d'ajuster leur position temporelle.

## Mode Show

Le mode Show simplifie l'interface pour l'exploitation.

Il met notamment en avant :

- le **PROCHAIN TOP** ;
- la timeline ;
- les TOPS de la conduite ;
- le **MONITOR VIDÉO** lorsqu'un média vidéo est utilisé.

Les éléments réservés à la préparation sont masqués afin de limiter les modifications accidentelles pendant le spectacle.

## Audio et vidéo

ShowCue accepte un média principal :

- **audio**, ou
- **vidéo**.

Avec une vidéo, l'image apparaît dans le monitor intégré tandis que le son du média reste utilisable pour la conduite.

La compatibilité exacte des formats dépend également des formats multimédias pris en charge par le navigateur et le système utilisés.

## Monitor vidéo et sortie externe

Lorsqu'une vidéo est chargée, ShowCue affiche un **MONITOR VIDÉO**.

### Mac / PC

Sur les navigateurs compatibles, ShowCue peut ouvrir une sortie vidéo séparée destinée à un autre écran.

La sortie externe est volontairement muette afin d'éviter un doublage du son avec l'interface principale.

### iPad

Le monitor vidéo local reste disponible.

La PWA ne garantit pas le ciblage indépendant d'un écran externe comme le ferait une application native. Le bouton de sortie vidéo externe est donc désactivé sur iPad et ShowCue indique :

> Sortie vidéo externe indisponible sur iPad — monitoring local actif.

---

# 2. Sauvegarde des projets

ShowCue utilise deux mécanismes différents.

## Sauvegarde automatique locale

L'état de travail est enregistré localement dans le navigateur grâce à **IndexedDB**.

Cette sauvegarde est pratique pour reprendre une préparation sur le même appareil et dans le même navigateur.

Elle ne doit toutefois pas être considérée comme une sauvegarde portable : les données du navigateur peuvent être supprimées si les données du site sont effacées.

## Export `.showcue.zip`

Pour conserver, archiver ou transférer une conduite, utiliser l'export ShowCue.

Le fichier `.showcue.zip` regroupe le projet et ses médias nécessaires.

Il peut ensuite être :

- conservé comme sauvegarde ;
- transféré sur une autre machine ;
- rouvert dans ShowCue ;
- utilisé avec **ShowCue for QLab**.

Pour une conduite importante, l'export `.showcue.zip` est la sauvegarde recommandée.

---

# 3. Installation de la PWA

Les fichiers de la version web se trouvent dans :

```text
PWA/
```

La PWA doit être servie depuis un serveur web adapté, idéalement en **HTTPS**, pour bénéficier correctement des fonctions d'installation et de cache hors ligne.

## iPad / iPhone

Avec Safari :

1. ouvrir l'adresse de ShowCue ;
2. utiliser le menu de partage ;
3. choisir **Sur l'écran d'accueil** ;
4. lancer ensuite ShowCue depuis son icône.

## Mac / PC / Android

Sur un navigateur prenant en charge l'installation des PWA, utiliser la fonction **Installer** proposée par ShowCue ou par le navigateur.

L'interface contient également une aide d'installation lors de la première utilisation.

---

# 4. ShowCue for QLab — V1.1

**ShowCue for QLab** est l'application macOS complémentaire destinée à **QLab 5**.

Elle permet de transformer une conduite préparée avec ShowCue en éléments exploitables dans un workspace QLab.

Les sources se trouvent dans :

```text
ShowCue-for-QLab/
```

## Fonctions principales

- ouverture/import d'un package ShowCue ;
- prise en charge d'un média principal audio ou vidéo ;
- création des éléments QLab associés à la conduite ;
- création d'un Group cue pour organiser le ShowCue importé ;
- import de plusieurs packages ShowCue ;
- visualiseur externe des prochains TOPS ;
- suivi du timecode du média dans QLab ;
- conservation d'un index des ShowCues associés au workspace.

## Workflow ShowCue → QLab

```text
ShowCue PWA
   ↓
Préparation de la conduite
   ↓
Export .showcue.zip
   ↓
ShowCue for QLab
   ↓
Import du package
   ↓
Création des cues dans QLab 5
```

Cela permet de préparer une conduite avec l'interface simple de ShowCue, puis de poursuivre l'exploitation dans l'environnement QLab lorsqu'un spectacle nécessite une régie plus complète.

---

# 5. Compilation de ShowCue for QLab

La version macOS est fournie sous forme de sources dans ce dépôt.

Prérequis de compilation :

- macOS ;
- outils de développement Apple nécessaires à la compilation Swift ;
- QLab 5 pour l'utilisation finale.

Depuis le Terminal :

```bash
cd ShowCue-for-QLab
chmod +x build.sh
./build.sh
```

Le script construit l'application et applique une signature locale **ad hoc**.

Cette signature permet les tests et l'utilisation locale sans nécessiter la publication de l'application sur le Mac App Store.

---

# 6. Compatibilité

| Fonction | iPad | Mac | PC | Android | Mac + QLab 5 |
|---|:---:|:---:|:---:|:---:|:---:|
| ShowCue PWA | ✓ | ✓ | ✓ | ✓ | ✓ |
| Média audio | ✓ | ✓ | ✓ | ✓ | ✓ |
| Média vidéo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Création / édition des TOPS | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mode Show | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monitor vidéo local | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sortie vidéo externe ShowCue | — | Selon navigateur | Selon navigateur | Selon navigateur | Selon navigateur |
| Export `.showcue.zip` | ✓ | ✓ | ✓ | ✓ | ✓ |
| ShowCue for QLab | — | — | — | — | ✓ |

`—` signifie que cette fonction n'est pas proposée sur cette plateforme.

---

# 7. Limites à connaître

### Données locales

La sauvegarde automatique reste liée au navigateur et à l'appareil. Pour déplacer ou archiver un spectacle, utiliser un fichier `.showcue.zip`.

### Sortie vidéo sur iPad

La version PWA conserve le monitoring local mais ne garantit pas une sortie indépendante vers un écran externe.

### Formats multimédias

La lecture dépend en partie des codecs et formats acceptés par le navigateur et le système d'exploitation.

### ShowCue for QLab

L'application QLab est spécifique à macOS et à QLab 5. Elle ne remplace pas QLab : elle sert de passerelle entre un projet ShowCue et un workspace QLab.

---

# 8. Structure du dépôt

```text
ShowCue-by-S2A-Production/
├── README.md
├── PWA/
│   ├── README.md
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   └── icons/
└── ShowCue-for-QLab/
    ├── README.md
    ├── Sources/
    │   └── ShowCueForQLab.swift
    ├── Resources/
    │   └── ShowCueIcon.png
    └── build.sh
```

---

# 9. Versions

| Composant | Version |
|---|---:|
| ShowCue PWA | **1.1.16** |
| ShowCue for QLab | **1.1** |

---

## S2A Production

ShowCue est développé pour les besoins de préparation et d'exploitation de conduites de spectacle par **S2A Production**.

Le projet est en développement actif.

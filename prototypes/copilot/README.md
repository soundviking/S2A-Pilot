# S2A Pilot TEST → S2A Copilot TEST

Prototype indépendant. Il ne lit ni ne modifie les conduites de S2A Pilot. Le récepteur n’a aucune commande de lecture, de navigation ou d’édition. Aucun média n’est transmis.

## Essai sur ordinateur

Node.js 18 ou plus récent :

```sh
cd prototypes/copilot
node server.cjs
```

Ouvrir `http://localhost:8098`, puis ouvrir le lien sous le QR dans un autre navigateur. Lecture/Pause, Cue suivante et Retour au début commandent uniquement la simulation. Les six Cues ont des titres, temps et consignes réalistes.

## Essai sur le même Wi-Fi

```sh
HOST=0.0.0.0 node server.cjs
```

Ouvrir le maître avec l’adresse Wi-Fi affichée par le serveur, **pas localhost**, pour obtenir un QR utilisable par les autres appareils. Le serveur doit rester accessible sur ce réseau ; les réseaux isolant leurs clients peuvent empêcher la connexion.

Pour tester sur iPhone/iPad, prévoir HTTPS et un certificat approuvé par les appareils. Le serveur accepte :

```sh
HOST=0.0.0.0 TLS_CERT=/chemin/certificat.pem TLS_KEY=/chemin/cle.pem node server.cjs
```

Ne pas exposer ce serveur de démonstration sur Internet. Il n’est pas un service de production. Les liens d’appairage donnent accès aux informations de la simulation pendant six heures. Le prototype n’est pas encore une PWA installable.

## Ce que vérifie le prototype

Le QR contient l’adresse locale et une clé de lecture. Un serveur local échange les offres, réponses et candidats ICE via HTTP/SSE. Après appairage, les Cues et le temps passent par **RTCDataChannel**. Aucun STUN, TURN ou service Internet n’est configuré. Le maître n’installe pas de gestionnaire de commandes entrantes. Les états reçus sont validés et affichés comme du texte.

Un état est envoyé toutes les 200 ms ; le récepteur interpole le décompte avec son horloge monotone. Après deux secondes sans état, le message « Connexion interrompue » apparaît et le décompte devient `--:--`. Le canal peut être reconstruit avec le signaler local ; un récepteur peut également recharger son lien. Une coupure de la signalisation seule n’arrête pas les canaux WebRTC déjà établis. Après un redémarrage du serveur, ou une nouvelle session du maître, il faut réappairer les récepteurs avec le nouveau QR.

## Architecture à décider

| Option | Sans Internet | Appairage QR | Contraintes |
|---|---|---|---|
| Signalisation locale, démontrée ici | Oui, si serveur et Wi-Fi restent actifs | Un lien par récepteur | Ordinateur/service local, adresse accessible, HTTPS sur appareils à valider |
| Signalisation Internet | Connexions existantes éventuellement ; nouveaux appairages indisponibles pendant la coupure | Simple | Hébergement et Internet pour l’échange initial/reconnexion |
| Échange manuel offre/réponse | Possible sur un réseau compatible | Deux échanges nécessaires | Manipulation peu adaptée aux techniciens ; non implémentée ici |

**Un QR seul ne remplace pas la signalisation.** Une PWA purement autonome ne peut pas, à elle seule, héberger ce serveur sur un iPhone. La mise en cache d’une PWA déjà installée et l’arrivée d’un nouvel appareil sans Internet sont deux problèmes distincts. Pour une PWA installable, un contexte HTTPS approuvé et une stratégie de cache seraient nécessaires.

## Résultats et limites

Voir [VALIDATION.md](VALIDATION.md). Tests automatisés Chrome/WebKit sur ce Mac : plusieurs récepteurs, changements de Cue, décompte, interruption du canal, reprise, rechargement, fonctionnement sans requête vers Internet. Les essais sur un vrai routeur Wi-Fi avec Internet débranché, et sur iPhone/iPad physiques, restent nécessaires. **iOS/iPadOS 13 est une cible, pas une compatibilité certifiée.** Aucune connexion n’est ajoutée à l’application Pilot publiée.

Bibliothèque QR embarquée : qrcode.js, licence MIT dans `vendor/LICENSE-qrcode.txt`. Le reste du prototype relève de la licence du dépôt.

Références techniques : [signalisation et connexions WebRTC](https://webrtc.org/getting-started/peer-connections), [canaux de données](https://webrtc.org/getting-started/data-channels), [conditions d’utilisation d’un service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

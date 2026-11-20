# Pilot 1.11.1 bêta / Bridge 1.6.29

- Télécommande Copilot : code obligatoire de quatre chiffres, configurable dans le popup hôte, vérifié côté serveur à la connexion et au changement de rôle. Limitation des essais, stockage privé sous forme de HMAC et invalidation des anciennes autorisations lors d’un changement de code.
- Suppression du paragraphe explicatif du popup Copilot ; champ de code compact et messages traduits FR/EN/ES/DE.
- Copilot/QLab : le halo suit la cue courante ; la sélection QLab seule ne provoque plus de halo ni de reconstruction de la liste.
- Marge de suivi de 20 pixels sous le bloc fixe.
- Bridge : Iceman pour tous les types de conduite, icône ambre BRIDGE et ailes cyan. Mise à jour du bundle et nouvelle signature ad hoc.
- Nettoyage ciblé : ancienne mention Bridge 1.6.4 corrigée dans l’export et ses traductions, instructions de déploiement obsolètes remplacées, bundles de compatibilité et cache hors ligne régénérés. Les anciennes archives restent conservées à part.

Vérifications : API PHP/SQLite avec scénarios d’accès, changement de rôle, rotation du code, annulation de commandes et limitation d’essais ; tests DOM des interfaces Pilot/Copilot/Bridge ; contrôle des versions, des assets hors ligne et des empreintes de signature des deux architectures Bridge.
Le lancement natif sur macOS, QLab et le test sur des téléphones physiques restent à effectuer sur le matériel réel.

-- ═══════════════════════════════════════════════════════════════════════
-- Habilitation de la page « Apports d'affaire », premier sujet du menu
-- Suivi.
--
-- Même principe que pour la page Dettes : une ligne pour chaque personne
-- déjà présente dans la table, quelle que soit la page qui l'y a fait
-- entrer. Le regroupement sur l'adresse en minuscules évite d'en créer
-- deux pour quelqu'un dont l'adresse serait orthographiée différemment
-- d'une ligne à l'autre, et MIN() conserve l'orthographe déjà stockée.
--
-- Pour restreindre plutôt qu'ouvrir à tous, remplacer le FROM par une
-- liste : FROM UNNEST(['michael@...','alban@...']) AS email, sans le
-- GROUP BY ni le HAVING.
--
-- À NE LANCER QU'UNE FOIS apports.html DÉPOSÉ : tant que la page n'existe
-- pas, l'entrée de menu mènerait à une erreur 404. Sans ces lignes, le
-- groupe Suivi reste invisible pour tout le monde, y compris vous.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO `db-finances-496809.Admin.Acces` (email, page)
SELECT MIN(email), 'apports'
FROM `db-finances-496809.Admin.Acces`
GROUP BY LOWER(TRIM(email))
HAVING LOGICAL_AND(page <> 'apports');

-- contrôle : qui voit quoi, après coup
SELECT email, STRING_AGG(page, ', ' ORDER BY page) AS pages
FROM `db-finances-496809.Admin.Acces`
GROUP BY 1 ORDER BY 1;

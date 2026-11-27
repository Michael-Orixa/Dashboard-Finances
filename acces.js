/* ═══════════════════════════════════════════════════════════════════════
   Contrôle d'accès commun aux pages du dashboard Orixa.

   Chargé par toutes les pages, il remplace les listes d'adresses qui
   étaient écrites en dur dans chacune d'elles — et donc publiées sur un
   dépôt public.

   Les habilitations vivent dans BigQuery, table Admin.Acces, lues à
   travers la vue Admin.V_Mes_acces qui ne rend que les lignes de la
   personne connectée. SESSION_USER() est résolu côté serveur : un
   navigateur ne peut pas le forger.

   Le principe est l'échec fermé. Tant que la requête n'a pas répondu
   « oui » pour la page courante, rien ne s'affiche. Une requête en erreur,
   un dataset inaccessible ou une réponse vide valent refus.

   Ce fichier sait aussi reconstituer le menu : une page ajoutée ici
   apparaît dans la barre latérale des pages déjà en ligne, sans qu'on ait
   à les rouvrir. C'est ce qui a permis d'ajouter « Dettes » en novembre
   sans toucher aux cinq autres fichiers.

   Rappel : ceci gouverne la navigation, pas la confidentialité. Ce qu'une
   personne peut réellement lire dépend de ses droits IAM sur les datasets.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const PROJET = 'db-finances-496809';

  /* ─────────────────────────────────────────────────────────────────────
     LE MENU, EN UN SEUL ENDROIT

     PAGES   : une entrée par page. La clé est le code stocké dans
               Admin.Acces ; le fichier est ce que le navigateur demande.
     PRINCIPALES : les pages de lecture courante, à plat en haut du menu.
     GROUPES : les familles repliables. `bas: true` place le groupe sous
               l'espaceur, au pied de la barre.

     POUR AJOUTER UNE PAGE, deux gestes :
       1. une entrée dans PAGES, et son code soit dans PRINCIPALES, soit
          dans les `pages` d'un groupe ;
       2. les lignes correspondantes dans Admin.Acces.
     Rien d'autre, et aucun autre fichier à redéployer.

     POUR AJOUTER UN GROUPE : une entrée dans GROUPES. Son pictogramme est
     le contenu d'un <svg viewBox="0 0 24 24"> ; les pages existantes
     portent déjà le style de ces groupes dans leur feuille CSS.
     ───────────────────────────────────────────────────────────────────── */

  const PAGES = {
    activite:    { fichier: 'index.html',            libelle: 'Activité',
      icone: '<path d="M3 12h4l3 8 4-16 3 8h4"/>' },
    marge_brute: { fichier: 'marge-brute.html',      libelle: 'Marge brute',
      icone: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
    historique:  { fichier: 'historique.html',       libelle: 'Historique P&L',
      icone: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>'
           + '<path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>' },
    dettes:      { fichier: 'dettes.html',           libelle: 'Dettes',
      icone: '<path d="M12 3 2 8h20z"/><path d="M5 21V10M9 21V10M15 21V10M19 21V10"/>'
           + '<path d="M3 21h18"/>' },
    apports:     { fichier: 'apports.html',          libelle: 'Apports d’affaire' },
    ms:          { fichier: 'ms-intragroupe.html',   libelle: 'MS intragroupe' },
    parametres:  { fichier: 'parametres.html',       libelle: 'Mise à jour des tables' },
    panneau:     { fichier: 'panneau-controle.html', libelle: 'Panneau de contrôle' }
  };

  const PRINCIPALES = ['activite', 'marge_brute', 'historique', 'dettes'];

  const GROUPES = [
    { id: 'suivi', libelle: 'Suivi', pages: ['apports', 'ms'],
      icone: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' },
    { id: 'param', libelle: 'Paramètres', pages: ['parametres', 'panneau'], bas: true,
      icone: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l'
           + '.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 '
           + '0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.'
           + '33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 '
           + '0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l'
           + '-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-'
           + '1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06'
           + '-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 '
           + '1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
  ];

  /* Déduits de ce qui précède : rien à tenir à jour en double. */
  const CODE = {};
  Object.keys(PAGES).forEach(c => CODE[PAGES[c].fichier.toLowerCase()] = c);
  const FICHIER = {};
  Object.keys(PAGES).forEach(c => FICHIER[c] = PAGES[c].fichier);
  /* ordre d'affichage, qui sert aussi à choisir la page de repli */
  const ORDRE = PRINCIPALES.concat(
    GROUPES.reduce((t, g) => t.concat(g.pages), []));
  const groupeDe = c => GROUPES.filter(g => g.pages.indexOf(c) >= 0)[0] || null;

  function pageCourante() {
    const f = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return CODE[f] || CODE[f + '.html'] || 'activite';
  }

  async function mesPages(token) {
    const r = await fetch(
      'https://bigquery.googleapis.com/bigquery/v2/projects/' + PROJET + '/queries',
      { method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'SELECT page FROM `' + PROJET + '.Admin.V_Mes_acces`',
          useLegacySql: false, timeoutMs: 30000 }) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('BQ ' + r.status + ' : '
        + ((e.error && e.error.message) || r.statusText));
    }
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return (d.rows || []).map(l => l.f[0].v);
  }

  /* ─────────────────── construction du menu ─────────────────── */

  const SVG = (contenu, cls) =>
    '<svg' + (cls ? ' class="' + cls + '"' : '')
    + ' viewBox="0 0 24 24" aria-hidden="true">' + contenu + '</svg>';

  /* Chaque page marque son entrée courante à sa façon : un <a href="#">
     sur parametres.html, un <button> sans lien sur marge-brute.html. Aucune
     de ces formes n'est retrouvable par son href, et vouloir « compléter »
     le menu y créerait un doublon. On reconnaît donc une entrée à son lien
     OU à son libellé — les libellés sont distincts d'une page à l'autre, et
     c'est la seule marque que toutes les formes ont en commun. */
  const normal = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function entree(portee, code) {
    const parLien = portee.querySelector('a.nav-btn[href="' + PAGES[code].fichier + '"]');
    if (parLien) return parLien;
    const cible = normal(PAGES[code].libelle);
    const cands = portee.querySelectorAll('a.nav-btn, button.nav-btn');
    for (let i = 0; i < cands.length; i++)
      if (!cands[i].classList.contains('nav-parent')
          && normal(cands[i].textContent) === cible) return cands[i];
    return null;
  }
  function manquante(portee, code, ici) {
    return code !== ici && !entree(portee, code);
  }

  /* Le libellé est posé en nœud de texte et non en HTML : « Historique P&L »
     porte une esperluette, qu'une concaténation dans innerHTML obligerait à
     échapper — et qu'une comparaison de libellés retrouverait mal. */
  function lienPage(code, sous) {
    const a = document.createElement('a');
    a.className = 'nav-btn' + (sous ? ' sous' : '');
    a.href = PAGES[code].fichier;
    if (!sous && PAGES[code].icone) a.innerHTML = SVG(PAGES[code].icone);
    a.appendChild(document.createTextNode(PAGES[code].libelle));
    return a;
  }

  /* Retrouve le groupe dans la page — il n'a pas d'identifiant fiable d'une
     page à l'autre, on le reconnaît donc à ce qu'il contient — et le crée
     s'il n'y est pas. */
  function assurerGroupe(nav, g, ici) {
    let el = null;
    const candidats = nav.querySelectorAll('.nav-groupe');
    for (let i = 0; i < candidats.length && !el; i++)
      if (g.pages.some(c => entree(candidats[i], c))) el = candidats[i];

    if (!el) {
      el = document.createElement('div');
      el.className = 'nav-groupe';
      const b = document.createElement('button');
      b.className = 'nav-btn nav-parent';
      b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', 'sous-' + g.id);
      b.innerHTML = SVG(g.icone);
      b.appendChild(document.createTextNode(g.libelle));
      b.insertAdjacentHTML('beforeend', SVG('<path d="m6 9 6 6 6-6"/>', 'chev'));
      el.appendChild(b);
      el.insertAdjacentHTML('beforeend',
        '<div class="sous-menu" id="sous-' + g.id + '" hidden></div>');
      /* avant l'espaceur pour un groupe de contenu, après pour un groupe
         d'administration — l'espaceur pousse ce dernier en pied de barre. */
      nav.insertBefore(el, g.bas ? null : (nav.querySelector('.spacer') || null));
    }

    const sm = el.querySelector('.sous-menu');
    if (sm) g.pages.forEach(c => {
      if (manquante(sm, c, ici)) sm.appendChild(lienPage(c, true));
    });
    return el;
  }

  /* Insère ce que la page ne connaît pas encore : les pages principales à
     leur rang, puis les groupes. */
  function completerMenu(ici) {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return [];

    PRINCIPALES.forEach((code, i) => {
      if (!manquante(nav, code, ici) || !PAGES[code].icone) return;
      let avant = null;
      for (let j = i + 1; j < PRINCIPALES.length && !avant; j++)
        avant = entree(nav, PRINCIPALES[j]);
      nav.insertBefore(lienPage(code, false),
        avant || nav.querySelector('.spacer') || null);
    });

    const groupes = GROUPES.map(g => ({ def: g, el: assurerGroupe(nav, g, ici) }));

    const lien = entree(nav, ici);
    if (lien) lien.classList.add('active');
    return groupes;
  }

  /* Le menu suit les habilitations : une entrée non accordée disparaît.
     On agit sur le style en ligne plutôt que sur l'attribut hidden, que la
     règle .nav-btn{display:flex} de chaque page écraserait. */
  function ajusterMenu(groupes, pages) {
    document.querySelectorAll('.nav-btn[href]').forEach(a => {
      const f = (a.getAttribute('href') || '').split('/').pop().toLowerCase();
      const c = CODE[f];
      if (!c) return;
      a.style.display = pages.indexOf(c) >= 0 ? '' : 'none';
    });
    /* Un groupe apparaît dès qu'une de ses pages est accordée ; ses entrées,
       elles, ont déjà été traitées ci-dessus puisque ce sont des liens comme
       les autres. */
    groupes.forEach(({ def, el }) => {
      if (el) el.style.display =
        def.pages.some(c => pages.indexOf(c) >= 0) ? '' : 'none';
    });
  }

  /* Le repli, identique sur tous les groupes. Le garde-fou évite un double
     branchement si la page avait déjà son propre écouteur. */
  function brancherGroupes(groupes, ici) {
    groupes.forEach(({ def, el }) => {
      if (!el) return;
      const b = el.querySelector('.nav-parent');
      const s = el.querySelector('.sous-menu');
      if (!b || !s) return;
      if (!b.dataset.branche) {
        b.dataset.branche = '1';
        b.addEventListener('click', () => {
          const ouvert = b.getAttribute('aria-expanded') === 'true';
          b.setAttribute('aria-expanded', String(!ouvert));
          s.hidden = ouvert;
        });
      }
      /* quand on est déjà dans la section, le groupe s'ouvre d'emblée */
      if (def.pages.indexOf(ici) >= 0) {
        b.setAttribute('aria-expanded', 'true');
        s.hidden = false;
      }
    });
  }

  function refus(titre, texte, detail) {
    document.body.innerHTML =
      '<div style="position:fixed;inset:0;display:flex;align-items:center;'
      + 'justify-content:center;background:#0f1117;color:#e8eaf0;'
      + 'font-family:\'DM Sans\',system-ui,sans-serif;padding:24px;z-index:9999">'
      + '<div style="max-width:480px">'
      + '<div style="font-size:17px;font-weight:600;margin-bottom:10px">'
      + titre + '</div>'
      + '<div style="font-size:13.5px;line-height:1.55;color:#9aa0b4">'
      + texte + '</div>'
      + (detail ? '<div style="margin-top:14px;font-family:ui-monospace,Menlo,monospace;'
        + 'font-size:11.5px;color:#6b7280;word-break:break-word">' + detail + '</div>' : '')
      + '<div style="margin-top:18px"><button onclick="acces_deconnexion()" '
      + 'style="padding:7px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.14);'
      + 'background:transparent;color:#9aa0b4;font:inherit;font-size:12.5px;cursor:pointer">'
      + 'Se déconnecter</button></div>'
      + '</div></div>';
  }

  /* Depuis un écran de refus, la seule action utile est de repartir sur un
     autre compte : on vide le jeton plutôt que de renvoyer vers une page qui
     refusera de nouveau. */
  window.acces_deconnexion = function () {
    try {
      localStorage.removeItem('bq_token');
      localStorage.removeItem('bq_token_ts');
    } catch (e) { /* navigation privée : rien à vider */ }
    location.href = 'index.html';
  };

  /* Rend true si la page peut s'afficher. Sinon elle a déjà été remplacée
     par un écran de refus, ou une redirection est en cours. */
  window.controlerAcces = async function (token) {
    const ici = pageCourante();
    let pages = [], motif = '';

    try { pages = await mesPages(token); }
    catch (e) { motif = (e && e.message) || String(e); }

    if (pages.indexOf(ici) >= 0) {
      const groupes = completerMenu(ici);
      ajusterMenu(groupes, pages);
      brancherGroupes(groupes, ici);
      return true;
    }

    /* La page n'est pas accordée. S'il en reste une qui l'est, on y va ;
       sinon on affiche un refus — jamais une redirection vers une page
       elle-même refusée, qui ferait boucler le navigateur. */
    const repli = ORDRE.filter(c => pages.indexOf(c) >= 0)[0];
    if (repli) {
      location.replace(FICHIER[repli]);
      return false;
    }

    refus(
      motif ? 'Habilitation non vérifiable' : 'Accès non habilité',
      motif
        ? "Vos droits n'ont pas pu être lus. Si la situation persiste, "
          + "signalez-le : il peut s'agir d'un droit manquant sur le dataset "
          + 'Admin plutôt que d\'une habilitation absente.'
        : "Votre compte n'est habilité sur aucune page du dashboard. "
          + 'Demandez votre inscription dans la table Admin.Acces.',
      motif);
    return false;
  };

  /* Exposé pour les tests : la déclaration du menu, sans effet de bord. */
  window.acces_menu = { PAGES, PRINCIPALES, GROUPES, ORDRE, CODE, groupeDe };
})();

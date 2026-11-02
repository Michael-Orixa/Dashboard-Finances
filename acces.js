/* ═══════════════════════════════════════════════════════════════════════
   Contrôle d'accès commun aux pages du dashboard Orixa.

   Chargé par index.html, marge-brute.html, historique.html et
   parametres.html, il remplace les listes d'adresses qui étaient écrites
   en dur dans chacune d'elles — et donc publiées sur un dépôt public.

   Les habilitations vivent dans BigQuery, table Admin.Acces, lues à
   travers la vue Admin.V_Mes_acces qui ne rend que les lignes de la
   personne connectée. SESSION_USER() est résolu côté serveur : un
   navigateur ne peut pas le forger.

   Le principe est l'échec fermé. Tant que la requête n'a pas répondu
   « oui » pour la page courante, rien ne s'affiche. Une requête en erreur,
   un dataset inaccessible ou une réponse vide valent refus.

   Rappel : ceci gouverne la navigation, pas la confidentialité. Ce qu'une
   personne peut réellement lire dépend de ses droits IAM sur les datasets.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const PROJET = 'db-finances-496809';

  /* Un code de page par fichier. Le code est ce qui est stocké en base ;
     le fichier, ce que le navigateur demande. */
  const CODE = {
    'index.html':       'activite',
    'marge-brute.html': 'marge_brute',
    'historique.html':  'historique',
    'parametres.html':  'parametres',
    'panneau-controle.html': 'panneau'
  };
  const FICHIER = {
    activite:    'index.html',
    marge_brute: 'marge-brute.html',
    historique:  'historique.html',
    parametres:  'parametres.html',
    panneau:     'panneau-controle.html'
  };
  /* ordre d'affichage, qui sert aussi à choisir la page de repli */
  const ORDRE = ['activite', 'marge_brute', 'historique', 'parametres', 'panneau'];

  /* Pages logées sous l'engrenage « Paramètres ». Le groupe s'affiche dès
     qu'une seule d'entre elles est accordée, et chaque entrée se montre ou
     se cache pour son propre compte.

     POUR AJOUTER UNE PAGE SOUS PARAMÈTRES, quatre gestes :
       1. une ligne dans CODE et dans FICHIER, et son code ici ;
       2. sa place dans ORDRE ;
       3. un <a class="nav-btn sous" href="…"> dans le sous-menu des
          quatre barres latérales ;
       4. les lignes correspondantes dans Admin.Acces.
     Rien d'autre n'est à toucher. */
  const SOUS = ['parametres', 'panneau'];

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

  /* Le menu suit les habilitations : une entrée non accordée disparaît.
     On agit sur le style en ligne plutôt que sur l'attribut hidden, que la
     règle .nav-btn{display:flex} de chaque page écraserait. */
  function ajusterMenu(pages) {
    document.querySelectorAll('.nav-btn[href]').forEach(a => {
      const f = (a.getAttribute('href') || '').split('/').pop().toLowerCase();
      const c = CODE[f];
      if (!c) return;
      a.style.display = pages.indexOf(c) >= 0 ? '' : 'none';
    });
    /* Le groupe « Paramètres » apparaît dès qu'une de ses entrées est
       accordée ; ses entrées, elles, ont déjà été traitées ci-dessus
       puisque ce sont des liens comme les autres. */
    const grp = document.getElementById('grpParam');
    if (grp) grp.style.display =
      SOUS.some(c => pages.indexOf(c) >= 0) ? '' : 'none';
  }

  /* Le repli du groupe, identique sur les quatre pages. Le garde-fou évite
     un double branchement si la page avait déjà son propre écouteur. */
  function brancherGroupe() {
    const b = document.getElementById('btnParam');
    const s = document.getElementById('sousParam');
    if (!b || !s || b.dataset.branche) return;
    b.dataset.branche = '1';
    b.addEventListener('click', () => {
      const ouvert = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!ouvert));
      s.hidden = ouvert;
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
      ajusterMenu(pages);
      brancherGroupe();
      /* quand on est déjà dans la section, le groupe s'ouvre d'emblée */
      if (SOUS.indexOf(ici) >= 0) {
        const b = document.getElementById('btnParam');
        const s = document.getElementById('sousParam');
        if (b && s) { b.setAttribute('aria-expanded', 'true'); s.hidden = false; }
      }
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
})();

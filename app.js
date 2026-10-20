// =========================================================
// 1. NAVIGATION ENTRE LES PAGES (brique 2)
// =========================================================

const onglets = document.querySelectorAll(".onglet");
const pages = document.querySelectorAll(".page");

function afficherPage(nom) {
  pages.forEach(function (page) {
    page.hidden = page.id !== nom;
  });
  onglets.forEach(function (onglet) {
    onglet.classList.toggle("actif", onglet.dataset.page === nom);
  });
  window.scrollTo(0, 0);
}

onglets.forEach(function (onglet) {
  onglet.addEventListener("click", function () {
    afficherPage(onglet.dataset.page);
  });
});


// =========================================================
// 2. LES DONNÉES (brique 3)
// Toutes les recettes et dépenses sont rangées dans un seul
// tableau. Chaque élément ressemble à ceci :
// {
//   id: "1729420000000",     identifiant unique
//   type: "recette",         "recette" ou "depense"
//   libelle: "Salaire McDo",
//   montant: 950,
//   categorie: "Salaire",
//   date: "2026-10-05",      format AAAA-MM-JJ
//   frequence: "mensuel"     "ponctuel" ou "mensuel"
// }
// Pour l'instant ce tableau est vidé quand on recharge la page.
// La brique 4 servira à le garder en mémoire.
// =========================================================

let mouvements = [];


// =========================================================
// 3. DES PETITS OUTILS
// =========================================================

// Transforme 1234.5 en "1 234,50 €".
function formaterEuros(nombre) {
  return nombre.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Transforme "2026-10-05" en "5 oct. 2026".
function formaterDate(texte) {
  const date = new Date(texte + "T00:00:00");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// Renvoie "2026-10" pour la date du jour : l'année et le mois en cours.
function moisActuel() {
  const aujourdhui = new Date();
  const mois = String(aujourdhui.getMonth() + 1).padStart(2, "0");
  return aujourdhui.getFullYear() + "-" + mois;
}

// Est-ce que ce mouvement compte pour un mois donné (ex. "2026-10") ?
// - ponctuel : oui seulement si sa date tombe dans ce mois ;
// - mensuel : oui pour son mois de départ et tous les mois suivants.
function comptePourLeMois(mouvement, mois) {
  const moisDuMouvement = mouvement.date.slice(0, 7); // "2026-10-05" → "2026-10"
  if (mouvement.frequence === "mensuel") {
    return moisDuMouvement <= mois;
  }
  return moisDuMouvement === mois;
}

// Additionne les montants d'un type ("recette" ou "depense") pour un mois.
function totalDuMois(type, mois) {
  let total = 0;
  mouvements.forEach(function (m) {
    if (m.type === type && comptePourLeMois(m, mois)) {
      total = total + m.montant;
    }
  });
  return total;
}


// =========================================================
// 4. AJOUTER UN MOUVEMENT (quand on valide un formulaire)
// =========================================================

const formulaires = document.querySelectorAll(".formulaire");

formulaires.forEach(function (formulaire) {
  // Date du jour proposée par défaut dans le champ Date.
  formulaire.elements.date.value = new Date().toISOString().slice(0, 10);

  formulaire.addEventListener("submit", function (evenement) {
    // Empêche la page de se recharger (comportement par défaut d'un formulaire).
    evenement.preventDefault();

    const champs = formulaire.elements;
    const nouveau = {
      id: String(Date.now()),
      type: formulaire.dataset.type,
      libelle: champs.libelle.value.trim(),
      montant: Number(champs.montant.value),
      categorie: champs.categorie.value,
      date: champs.date.value,
      frequence: champs.frequence.value
    };

    mouvements.push(nouveau);

    // On vide le libellé et le montant pour la saisie suivante,
    // et on remet le curseur dans le premier champ.
    champs.libelle.value = "";
    champs.montant.value = "";
    champs.libelle.focus();

    toutAfficher();
  });
});


// =========================================================
// 5. SUPPRIMER UN MOUVEMENT
// =========================================================

function supprimer(id) {
  // On garde tous les mouvements SAUF celui qui a cet id.
  mouvements = mouvements.filter(function (m) {
    return m.id !== id;
  });
  toutAfficher();
}


// =========================================================
// 6. AFFICHER (on redessine tout à chaque changement)
// =========================================================

// Remplit la liste d'un type ("recette" ou "depense").
function afficherListe(type) {
  const liste = document.getElementById("liste-" + type);
  liste.innerHTML = ""; // on vide la liste avant de la remplir

  // Les plus récents en premier.
  const lignes = mouvements
    .filter(function (m) { return m.type === type; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });

  lignes.forEach(function (m) {
    const li = document.createElement("li");
    li.className = "ligne";

    // La partie gauche : libellé + catégorie et date.
    const info = document.createElement("div");
    info.className = "ligne-info";

    const libelle = document.createElement("p");
    libelle.className = "ligne-libelle";
    libelle.textContent = m.libelle;
    if (m.frequence === "mensuel") {
      const pastille = document.createElement("span");
      pastille.className = "pastille";
      pastille.textContent = "Tous les mois";
      libelle.appendChild(pastille);
    }

    const details = document.createElement("p");
    details.className = "ligne-details";
    details.textContent = m.categorie + " · " + formaterDate(m.date);

    info.append(libelle, details);

    // Le montant, avec + ou − devant.
    const montant = document.createElement("span");
    const signe = type === "recette" ? "+ " : "− ";
    montant.className = "ligne-montant " + (type === "recette" ? "positif" : "negatif");
    montant.textContent = signe + formaterEuros(m.montant);

    // Le bouton de suppression.
    const bouton = document.createElement("button");
    bouton.className = "supprimer";
    bouton.type = "button";
    bouton.textContent = "×";
    bouton.setAttribute("aria-label", "Supprimer " + m.libelle);
    bouton.addEventListener("click", function () {
      supprimer(m.id);
    });

    li.append(info, montant, bouton);
    liste.appendChild(li);
  });

  // Le total du mois en cours, à droite du titre.
  document.getElementById("total-" + type).textContent =
    "Ce mois-ci : " + formaterEuros(totalDuMois(type, moisActuel()));
}

// Met à jour les tuiles de la page Aperçu.
function afficherApercu() {
  const mois = moisActuel();
  const recettes = totalDuMois("recette", mois);
  const depenses = totalDuMois("depense", mois);
  const solde = recettes - depenses;

  // Le nom du mois en haut : "Octobre 2026".
  const nomDuMois = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  document.getElementById("mois-courant").textContent = nomDuMois;

  document.getElementById("apercu-recettes").textContent = formaterEuros(recettes);
  document.getElementById("apercu-depenses").textContent = formaterEuros(depenses);

  const caseSolde = document.getElementById("apercu-solde");
  caseSolde.textContent = formaterEuros(solde);
  caseSolde.classList.toggle("positif", solde > 0);
  caseSolde.classList.toggle("negatif", solde < 0);

  // Le message d'attente disparaît dès qu'il y a une donnée.
  document.getElementById("apercu-vide").hidden = mouvements.length > 0;
}

function toutAfficher() {
  afficherListe("recette");
  afficherListe("depense");
  afficherApercu();
}

// Premier affichage au chargement de la page.
toutAfficher();

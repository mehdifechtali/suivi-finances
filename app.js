// =========================================================
// NAVIGATION ENTRE LES PAGES
// Quand on clique sur un onglet, on affiche la bonne section
// et on cache les autres.
// =========================================================

// 1. On récupère tous les boutons du menu et toutes les sections.
const onglets = document.querySelectorAll(".onglet");
const pages = document.querySelectorAll(".page");

// 2. Une fonction qui affiche la page dont on lui donne le nom.
function afficherPage(nom) {
  // On cache toutes les sections, sauf celle qui a le bon id.
  pages.forEach(function (page) {
    page.hidden = page.id !== nom;
  });

  // On met en surbrillance le bon onglet.
  onglets.forEach(function (onglet) {
    onglet.classList.toggle("actif", onglet.dataset.page === nom);
  });

  // On remonte en haut de la page.
  window.scrollTo(0, 0);
}

// 3. On dit à chaque bouton : "quand on te clique, affiche ta page".
onglets.forEach(function (onglet) {
  onglet.addEventListener("click", function () {
    afficherPage(onglet.dataset.page);
  });
});

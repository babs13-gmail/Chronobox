// ============================================
// NAVIGATION ENTRE VUES
// ============================================
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
  document.getElementById(id).classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.getElementById("startCreateBtn").addEventListener("click", () => showView("view-create"));

// ============================================
// OUVRIR UNE CAPSULE VIA UN LIEN/CODE COLLÉ
// ============================================
document.getElementById("openLinkForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = document.getElementById("openLinkInput").value.trim();
  if (!raw) return;

  // Accepte soit un lien complet, soit juste le code
  let id = raw;
  try {
    const url = new URL(raw);
    id = url.searchParams.get("id") || raw;
  } catch {
    // ce n'était pas une URL valide, on garde raw tel quel comme code
  }

  window.location.href = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(id)}`;
});

// ============================================
// APERÇU DU FICHIER PHOTO CHOISI
// ============================================
document.getElementById("capsulePhoto").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const hint = document.getElementById("photoHint");
  if (!file) { hint.textContent = ""; return; }
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  hint.textContent = `${file.name} (${sizeMB} Mo)`;
});

// ============================================
// COPIER LE LIEN GÉNÉRÉ
// ============================================
document.getElementById("copyLinkBtn").addEventListener("click", async () => {
  const input = document.getElementById("generatedLink");
  const status = document.getElementById("copyStatus");
  try {
    await navigator.clipboard.writeText(input.value);
    status.textContent = "Lien copié !";
  } catch {
    input.select();
    document.execCommand("copy");
    status.textContent = "Lien copié !";
  }
  setTimeout(() => (status.textContent = ""), 3000);
});

document.getElementById("viewMyCapsuleBtn").addEventListener("click", () => {
  window.location.href = document.getElementById("generatedLink").value;
});

// ============================================
// COMPTE À REBOURS — mis à jour chaque seconde
// (démarré depuis capsule.js une fois la date connue)
// ============================================
let countdownInterval = null;

window.startCountdown = function (targetDate) {
  if (countdownInterval) clearInterval(countdownInterval);

  function tick() {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      clearInterval(countdownInterval);
      window.onCapsuleUnlocked?.();
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    document.getElementById("cdDays").textContent = days;
    document.getElementById("cdHours").textContent = String(hours).padStart(2, "0");
    document.getElementById("cdMinutes").textContent = String(minutes).padStart(2, "0");
    document.getElementById("cdSeconds").textContent = String(seconds).padStart(2, "0");
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
};

window.showViewGlobal = showView; // rendu accessible à capsule.js

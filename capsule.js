// ============================================
// CHRONOBOX — Firebase Firestore + Storage
//
// ⚠️ ÉTAPE OBLIGATOIRE : crée un NOUVEAU projet Firebase
// appelé par exemple "chronobox", active Firestore ET Storage,
// puis colle sa config ci-dessous.
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRIXYvhspun8gUxr7M76xcb9nJFtwCmyE",
  authDomain: "chronobox-ad980.firebaseapp.com",
  projectId: "chronobox-ad980",
  storageBucket: "chronobox-ad980.firebasestorage.app",
  messagingSenderId: "666881889680",
  appId: "1:666881889680:web:2596612a57bcdcf36c8f15"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================
// COMPRESSION D'IMAGE — redimensionne et compresse
// une photo dans le navigateur, pour la stocker
// directement dans Firestore (pas besoin de Storage,
// qui demanderait le forfait payant Blaze)
// ============================================
function compressImage(file, maxWidth = 700, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// CRÉATION D'UNE CAPSULE
//
// Structure Firestore (voir les règles de sécurité à publier) :
//   capsules/{id}              -> { unlockAt }            toujours lisible
//   capsules/{id}/private/data -> { message, photoUrl }    lisible seulement après unlockAt
// ============================================
const createForm = document.getElementById("createForm");

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = document.getElementById("capsuleMessage").value.trim();
  const dateValue = document.getElementById("capsuleDate").value;
  const photoFile = document.getElementById("capsulePhoto").files[0];
  const status = document.getElementById("createStatus");
  const submitBtn = document.getElementById("submitCreateBtn");

  if (!message || !dateValue) return;

  const unlockAt = new Date(dateValue);
  if (unlockAt <= new Date()) {
    status.textContent = "Choisis une date dans le futur.";
    return;
  }

  submitBtn.disabled = true;
  status.textContent = "Scellement en cours...";

  try {
    // Génère un identifiant de capsule
    const capsuleRef = doc(collection(db, "capsules"));
    const capsuleId = capsuleRef.id;

    // Compresse la photo si présente et la garde en base64 (pas de Storage)
    let photoData = null;
    if (photoFile) {
      status.textContent = "Compression de la photo...";
      photoData = await compressImage(photoFile);
      // Sécurité : si malgré la compression c'est encore trop lourd pour
      // Firestore (limite ~1 Mo par document), on prévient plutôt que planter
      if (photoData.length > 900000) {
        status.textContent = "Cette photo est trop lourde, essaie une image plus simple.";
        submitBtn.disabled = false;
        return;
      }
    }

    // Document public : seulement la date (toujours lisible, sert au compte à rebours)
    await setDoc(capsuleRef, {
      unlockAt: Timestamp.fromDate(unlockAt),
      createdAt: Timestamp.now()
    });

    // Document privé : le vrai contenu, verrouillé par les règles Firestore
    await setDoc(doc(db, "capsules", capsuleId, "private", "data"), {
      message,
      photoData
    });

    // Génère le lien et passe à l'écran de confirmation
    const link = `${window.location.origin}${window.location.pathname}?id=${capsuleId}`;
    document.getElementById("generatedLink").value = link;
    createForm.reset();
    document.getElementById("photoHint").textContent = "";
    status.textContent = "";
    window.showViewGlobal("view-done");
  } catch (err) {
    console.error(err);
    status.textContent = "Erreur, réessaie.";
  } finally {
    submitBtn.disabled = false;
  }
});

// ============================================
// LECTURE D'UNE CAPSULE (?id=... dans l'URL)
// ============================================
async function loadCapsuleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return; // pas de capsule dans l'URL, on reste sur l'accueil

  window.showViewGlobal("view-capsule");

  const loadingEl = document.getElementById("capsuleLoading");
  const lockedEl = document.getElementById("capsuleLocked");
  const revealedEl = document.getElementById("capsuleRevealed");
  const errorEl = document.getElementById("capsuleError");

  try {
    const capsuleSnap = await getDoc(doc(db, "capsules", id));
    if (!capsuleSnap.exists()) {
      loadingEl.hidden = true;
      errorEl.hidden = false;
      return;
    }

    const unlockAt = capsuleSnap.data().unlockAt.toDate();
    loadingEl.hidden = true;

    if (unlockAt > new Date()) {
      // Encore verrouillée : on affiche juste le compte à rebours
      lockedEl.hidden = false;
      document.getElementById("unlockDateLabel").textContent =
        `Ouverture le ${unlockAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${unlockAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      window.startCountdown(unlockAt);

      // Quand le compte à rebours arrive à zéro, on tente de révéler automatiquement
      window.onCapsuleUnlocked = () => revealCapsule(id);
    } else {
      await revealCapsule(id);
    }
  } catch (err) {
    console.error(err);
    loadingEl.hidden = true;
    errorEl.hidden = false;
  }
}

async function revealCapsule(id) {
  const lockedEl = document.getElementById("capsuleLocked");
  const revealedEl = document.getElementById("capsuleRevealed");
  const errorEl = document.getElementById("capsuleError");

  try {
    const dataSnap = await getDoc(doc(db, "capsules", id, "private", "data"));
    if (!dataSnap.exists()) {
      errorEl.hidden = false;
      return;
    }

    const data = dataSnap.data();
    document.getElementById("revealedMessage").textContent = data.message;

    if (data.photoData) {
      document.getElementById("revealedPhoto").src = data.photoData;
      document.getElementById("revealedPhotoWrap").hidden = false;
    }

    lockedEl.hidden = true;
    revealedEl.hidden = false;
  } catch (err) {
    // Si les règles Firestore bloquent encore la lecture (horloge légèrement
    // désynchronisée entre appareils), on retente dans quelques secondes
    console.error("Pas encore accessible, nouvelle tentative...", err);
    setTimeout(() => revealCapsule(id), 3000);
  }
}

loadCapsuleFromUrl();

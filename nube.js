// Inicio de sesión con Google y acceso a los datos (Firebase). La configuración va en config.js.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, getDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FIREBASE, EQUIPO } from './config.js';
import { SEMILLA } from './semilla.js';

// Same small surface the panel already uses: collection(x).add / doc(id).set|update|delete / onSnapshot.
function adaptador(fs) {
  return {
    collection(nombre) {
      const ref = collection(fs, nombre);
      return {
        add: (datos) => addDoc(ref, datos),
        doc(id) {
          const r = doc(fs, nombre, id);
          return { set: (datos) => setDoc(r, datos), update: (datos) => updateDoc(r, datos), delete: () => deleteDoc(r) };
        },
        onSnapshot: (siguiente, error) => onSnapshot(ref,
          (s) => siguiente({ docs: s.docs.map((d) => Object.assign({ id: d.id }, d.data())) }),
          (e) => error({ code: e.code }))
      };
    }
  };
}

// Loads the starting tasks, events and notes once, the first time someone from the team signs in.
async function sembrar(fs) {
  const marca = doc(fs, 'config', 'inicio');
  if ((await getDoc(marca)).exists()) return;
  const lote = writeBatch(fs);
  for (const [col, docs] of Object.entries(SEMILLA)) {
    for (const [id, datos] of Object.entries(docs)) lote.set(doc(fs, col, id), datos);
  }
  lote.set(marca, { sembrado: new Date().toISOString() });
  await lote.commit();
}

export function iniciar({ alEntrar, alSalir, alError }) {
  if (!FIREBASE.apiKey) { alError('Falta la configuración de Firebase en config.js.'); return; }
  const app = initializeApp(FIREBASE);
  const auth = getAuth(app);
  const fs = getFirestore(app);
  const proveedor = new GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: 'select_account' });

  document.getElementById('entrar-google').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, proveedor);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, proveedor);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/unauthorized-domain') return alError('Esta dirección no está autorizada en Firebase. Añádela en Authentication → Configuración → Dominios autorizados.');
      alError('No se ha podido entrar con Google. Inténtalo de nuevo.');
    }
  });
  document.getElementById('salir').addEventListener('click', async () => { await signOut(auth); location.reload(); });
  getRedirectResult(auth).catch(() => {});

  onAuthStateChanged(auth, async (u) => {
    if (!u) { alSalir(); return; }
    const email = (u.email || '').toLowerCase();
    try { await sembrar(fs); } catch (e) { /* Not on the team, or offline: the listeners report it. */ }
    alEntrar({ email, nombre: u.displayName || email, persona: EQUIPO[email] || null }, adaptador(fs));
  });
}

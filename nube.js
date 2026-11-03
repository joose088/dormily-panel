// Entrada con nombre + código del equipo y acceso a los datos (Firebase). La configuración va en config.js.
// El código es la contraseña de una única cuenta de Firebase (CUENTA_EQUIPO); nunca se guarda en el código fuente.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, getDoc, writeBatch, arrayUnion, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { FIREBASE, CUENTA_EQUIPO, NOMBRES } from './config.js';
import { SEMILLA } from './semilla.js';

const CLAVE_QUIEN = 'dormily-panel-quien';
const leerQuien = () => { try { return localStorage.getItem(CLAVE_QUIEN); } catch (e) { return null; } };
const guardarQuien = (q) => { try { if (q) localStorage.setItem(CLAVE_QUIEN, q); else localStorage.removeItem(CLAVE_QUIEN); } catch (e) {} };

const vista = (s) => ({ docs: s.docs.map((d) => Object.assign({ id: d.id }, d.data())) });

// Small surface the panel uses: collection(x).add / ultimos / doc(id).get|set|update|delete / onSnapshot, plus arrayUnion.
function adaptador(fs) {
  return {
    arrayUnion: (...valores) => arrayUnion(...valores),
    collection(nombre) {
      const ref = collection(fs, nombre);
      return {
        add: (datos) => addDoc(ref, datos),
        doc(id) {
          const r = doc(fs, nombre, id);
          return {
            get: async () => { const d = await getDoc(r); return d.exists() ? Object.assign({ id: d.id }, d.data()) : null; },
            set: (datos) => setDoc(r, datos),
            update: (datos) => updateDoc(r, datos),
            delete: () => deleteDoc(r)
          };
        },
        onSnapshot: (siguiente, error) => onSnapshot(ref, (s) => siguiente(vista(s)), (e) => error({ code: e.code })),
        ultimos(campo, n) {
          const q = query(ref, orderBy(campo, 'desc'), limit(n));
          return { onSnapshot: (siguiente, error) => onSnapshot(q, (s) => siguiente(vista(s)), (e) => error({ code: e.code })) };
        }
      };
    }
  };
}

// Loads each starting batch once, in order. config/inicio remembers which ones are already in.
// A key like «proveedores@2» is a later batch for that collection and is merged into existing documents.
async function sembrar(fs) {
  const marca = doc(fs, 'config', 'inicio');
  const snap = await getDoc(marca);
  const hecho = snap.exists() ? Object.assign({}, snap.data()) : {};
  if (hecho.sembrado) { hecho.tareas = true; hecho.eventos = true; hecho.notas = true; }
  for (const clave of Object.keys(SEMILLA)) {
    if (hecho[clave]) continue;
    const [col, tanda] = clave.split('@');
    const lote = writeBatch(fs);
    for (const [id, datos] of Object.entries(SEMILLA[clave])) {
      if (tanda) lote.set(doc(fs, col, id), datos, { merge: true }); else lote.set(doc(fs, col, id), datos);
    }
    lote.set(marca, { [clave]: true }, { merge: true });
    await lote.commit();
  }
}

const MENSAJES = {
  'auth/invalid-credential': 'Código incorrecto.',
  'auth/invalid-login-credentials': 'Código incorrecto.',
  'auth/wrong-password': 'Código incorrecto.',
  'auth/user-not-found': 'Falta crear la cuenta del equipo en Firebase (ver README).',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  'auth/operation-not-allowed': 'Falta activar «Correo electrónico/contraseña» en Firebase (ver README).',
  'auth/network-request-failed': 'Sin conexión. Revisa internet y vuelve a probar.'
};

export function iniciar({ alEntrar, alSalir, alError }) {
  const $ = (id) => document.getElementById(id);
  if (!FIREBASE.apiKey) { alError('Falta la configuración de Firebase en config.js.'); return; }
  const app = initializeApp(FIREBASE);
  const auth = getAuth(app);
  const fs = getFirestore(app);
  let quien = NOMBRES[leerQuien()] ? leerQuien() : null;
  let cuenta = null;
  let dentro = false;

  function verNombres() {
    $('entrada-pregunta').textContent = '¿Quién eres?';
    $('nombres').hidden = false; $('form-codigo').hidden = true;
  }
  function verCodigo() {
    $('entrada-pregunta').textContent = 'Hola, ' + NOMBRES[quien];
    $('nombres').hidden = true; $('form-codigo').hidden = false;
    $('codigo').value = ''; $('codigo').focus();
  }
  async function entrar() {
    if (dentro) return;
    dentro = true;
    try { await sembrar(fs); } catch (e) { /* Offline or no access: the listeners report it. */ }
    alEntrar({ nombre: NOMBRES[quien], persona: quien }, adaptador(fs));
  }

  $('nombres').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quien]');
    if (!b) return;
    quien = b.dataset.quien; guardarQuien(quien);
    $('entrada-error').hidden = true;
    if (cuenta) entrar(); else verCodigo();
  });
  $('otro-nombre').addEventListener('click', () => { quien = null; guardarQuien(null); $('entrada-error').hidden = true; verNombres(); });
  $('form-codigo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = $('codigo').value.trim();
    if (!codigo) { $('codigo').focus(); return; }
    const boton = $('boton-entrar');
    boton.disabled = true; boton.textContent = 'Entrando…';
    $('entrada-error').hidden = true;
    try {
      await signInWithEmailAndPassword(auth, CUENTA_EQUIPO, codigo);
    } catch (err) {
      alError(MENSAJES[err.code] || 'No se ha podido entrar. Inténtalo de nuevo.');
      $('codigo').select();
    } finally {
      boton.disabled = false; boton.textContent = 'Entrar';
    }
  });
  $('salir').addEventListener('click', async () => { guardarQuien(null); await signOut(auth); location.reload(); });

  onAuthStateChanged(auth, (u) => {
    cuenta = u;
    if (u && quien) { entrar(); return; }
    alSalir();
    if (quien && !u) verCodigo(); else verNombres();
  });
}

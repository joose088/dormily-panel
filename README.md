# Dormily · Panel del equipo

Web con tareas, calendario y notas para José Carlos, Alejandro y Hugo. Se entra con la cuenta de Google y solo pueden entrar los tres correos de `firestore.rules`.

- **Firebase** (de Google, plan gratuito Spark): inicio de sesión con Google y base de datos (Firestore).
- **Vercel** (como LogiScore): publica la web desde GitHub.
- Sin paso de compilación: son archivos estáticos.

## Puesta en marcha (una sola vez, unos 20 minutos)

### 1. Firebase
1. Entra en https://console.firebase.google.com con tu cuenta de Google y pulsa **Crear un proyecto** (por ejemplo `dormily-panel`). Google Analytics no hace falta.
2. **Authentication → Comenzar → Método de acceso → Google → Habilitar.** Elige el correo de asistencia y guarda.
3. **Firestore Database → Crear base de datos →** ubicación `eur3 (europe-west)` → modo **producción**.
4. En **Firestore → Reglas**, pega el contenido de `firestore.rules` con los tres correos reales y pulsa **Publicar**.
5. **Configuración del proyecto (rueda) → General → Tus apps → icono `</>` (Web)**. Ponle nombre, no marques Hosting y copia el bloque `firebaseConfig`.
6. Pega esos valores en `config.js` (`FIREBASE`) y pon los tres correos en `EQUIPO`.

### 2. GitHub y Vercel
1. Crea un repositorio privado en GitHub llamado `dormily-panel` y sube esta carpeta.
2. En https://vercel.com → **Add New → Project →** importa `dormily-panel` → **Deploy** (sin tocar nada: es un sitio estático).
3. Copia la dirección que te da Vercel (por ejemplo `dormily-panel.vercel.app`).

### 3. Autorizar la dirección en Firebase
**Authentication → Configuración → Dominios autorizados → Añadir dominio** y pega la dirección de Vercel (sin `https://`). Si más adelante usáis `panel.dormily.es`, añádela también.

### 4. Entrar
Abrid la dirección en Chrome o Safari y pulsad **Entrar con Google**. La primera vez que entre alguien del equipo se cargan las tareas iniciales (`semilla.js`).

En el móvil: **Añadir a pantalla de inicio** (Safari: botón Compartir; Chrome: menú ⋮) y queda como una app.

## Cambiar quién tiene acceso
Edita los correos en `firestore.rules` (y publícalas en Firebase) y en `config.js`, y sube el cambio a GitHub.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html` | La página: tareas, calendario y notas |
| `nube.js` | Inicio de sesión con Google y conexión con Firestore |
| `config.js` | Configuración de Firebase y correos del equipo |
| `firestore.rules` | Quién puede leer y escribir |
| `semilla.js` | Tareas, evento y notas iniciales |
| `manifest.webmanifest`, `icono*` | Icono y modo app en el móvil |

## Probar en local
```bash
python -m http.server 8766
```
Abre http://localhost:8766 (añade `localhost` a los dominios autorizados de Firebase si no está).

// 1) Pega aquí la configuración web de tu proyecto de Firebase:
//    Firebase → Configuración del proyecto → General → Tus apps → App web → «Configuración».
//    Estos datos no son secretos: lo que protege el panel son las reglas de firestore.rules.
export const FIREBASE = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

// 2) Cuentas de Google del equipo (en minúsculas) y a quién corresponde cada una en el panel.
//    Tienen que ser las mismas que pongas en firestore.rules.
export const EQUIPO = {
  'correo-de-jose-carlos@gmail.com': 'jc',
  'correo-de-alejandro@gmail.com': 'alejandro',
  'correo-de-hugo@gmail.com': 'hugo'
};

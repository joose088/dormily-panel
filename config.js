// Configuración web del proyecto de Firebase «dormily-panel».
// Estos datos no son secretos: lo que protege el panel son el código del equipo y las reglas de firestore.rules.
export const FIREBASE = {
  apiKey: 'AIzaSyBOE6S93gd_cwpxxFy1bSrW0f9VKOIhu-8',
  authDomain: 'dormily-panel.firebaseapp.com',
  projectId: 'dormily-panel',
  storageBucket: 'dormily-panel.firebasestorage.app',
  messagingSenderId: '587371123882',
  appId: '1:587371123882:web:28a344fb38caff177c6cd3'
};

// Cuenta única del equipo en Firebase (Authentication → Usuarios). Su contraseña es el código del equipo.
// Tiene que coincidir con el correo de firestore.rules.
export const CUENTA_EQUIPO = 'panel@dormily.es';

// Quién puede elegirse en la pantalla de entrada (clave = persona del panel).
export const NOMBRES = {
  jc: 'José Carlos',
  alejandro: 'Alejandro',
  hugo: 'Hugo'
};

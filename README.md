# Dormily · Panel del equipo

Web con tareas, calendario y notas para José Carlos, Alejandro y Hugo: https://dormily-panel.vercel.app

Para entrar, cada uno toca su nombre y escribe el **código del equipo**. El móvil lo recuerda, así que solo se escribe la primera vez.

## Secciones
| Sección | Qué hay |
|---|---|
| Tareas | Por hacer, en marcha y hecho; responsable, área, fecha límite, pasos y comentarios |
| Calendario | Eventos, fechas límite, llegadas de compras, publicaciones y siguientes pasos con proveedores. Botón «Añadir a Google Calendar» |
| Compras | Pedidos a proveedores: qué se pide, estado (de «por pedir» a «recibido»), fecha prevista, si está pagado y a qué pedido de Shopify va. Puede apuntar el gasto en Contabilidad. Las ventas están en Shopify |
| Contabilidad | Gastos e ingresos con IVA, facturas adjuntas (foto o PDF), cuentas entre socios («quién debe a quién») y exportación CSV para la gestoría |
| Proveedores | Estado de cada negociación, condiciones, contactos y siguiente paso |
| Contenido | Ideas y publicaciones para redes, de idea a publicado |
| Notas, Enlaces | Acuerdos y accesos directos a las herramientas |
| Actividad | Lo último que ha hecho cada uno |

### Facturas adjuntas
Se guardan dentro de Firestore (plan gratuito, sin Firebase Storage): las fotos se reducen solas a JPEG y los PDF pueden pesar hasta 700 KB. Para un PDF más grande, pega un enlace de Drive en el campo «Enlace a la factura».

- **Firebase** (plan gratuito): la cuenta del equipo y la base de datos (Firestore).
- **Vercel**: publica la web automáticamente cada vez que se sube un cambio a GitHub.
- Sin paso de compilación: son archivos estáticos.

## Cómo funciona el acceso
El código del equipo es la contraseña de una única cuenta de Firebase, `panel@dormily.es`. Esa dirección no tiene que existir como correo: solo identifica la cuenta. Las reglas de `firestore.rules` solo dejan leer y escribir a esa cuenta. El código no está en ningún archivo de este repositorio.

## Puesta en marcha en Firebase (una sola vez)
1. **Authentication → Método de acceso → Agregar proveedor nuevo → Correo electrónico/contraseña →** activa el primer interruptor → **Guardar**.
2. **Authentication → Usuarios → Agregar usuario**:
   - Correo: `panel@dormily.es`
   - Contraseña: el código del equipo
3. **Firestore Database → Reglas →** borra lo que haya, pega el contenido de `firestore.rules` y pulsa **Publicar**.

Listo: abrid https://dormily-panel.vercel.app, tocad vuestro nombre y escribid el código. La primera vez que entre alguien se cargan las tareas iniciales (`semilla.js`).

En el móvil: **Añadir a pantalla de inicio** (Safari: botón Compartir; Chrome: menú ⋮) y queda como una app.

## Cambiar el código
**Authentication → Usuarios →** en `panel@dormily.es`, menú ⋮ → **Restablecer contraseña** no sirve (el correo no existe): borra el usuario y créalo otra vez con el código nuevo. Los datos no se pierden.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html` | La página: entrada, tareas, calendario y notas |
| `nube.js` | Entrada con nombre y código, y conexión con Firestore |
| `config.js` | Configuración de Firebase, cuenta del equipo y nombres |
| `firestore.rules` | Quién puede leer y escribir |
| `semilla.js` | Datos iniciales (tareas, evento, notas, proveedores, ideas de contenido y enlaces). Cada colección se carga una sola vez |
| `manifest.webmanifest`, `icono*` | Icono y modo app en el móvil |

## Probar en local
```bash
python -m http.server 8766
```
Abre http://localhost:8766 (`localhost` ya viene autorizado en Firebase).

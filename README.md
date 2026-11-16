# Landez · Panel del equipo

Web con tareas, calendario y notas para José Carlos, Alejandro y Hugo: https://dormily-panel.vercel.app

Para entrar, cada uno toca su nombre y escribe el **código del equipo**. El móvil lo recuerda, así que solo se escribe la primera vez.

## Secciones
| Sección | Qué hay |
|---|---|
| Tareas | Por hacer, en marcha y hecho; responsable, área, fecha límite, pasos y comentarios |
| Gestión | Catálogo de productos (foto, referencia, características, precio, peso y volumen), clientes y documentos: presupuestos, pedidos y albaranes. Al hacer un documento se busca el producto y se añade con todo; un presupuesto pasa a pedido y un pedido a albarán con un botón. Se imprime o se guarda en PDF con la plantilla de `documento.js`. En «Datos de la empresa» van la razón social, el NIF, el domicilio y las condiciones que se ponen solas |
| Calendario | Eventos, fechas límite, llegadas de compras, publicaciones y siguientes pasos con proveedores. Botón «Añadir a Google Calendar» |
| Compras | Pedidos a proveedores: qué se pide, estado (de «por pedir» a «recibido»), fecha prevista, si está pagado y a qué pedido de Shopify va. Puede apuntar el gasto en Contabilidad. Las ventas están en Shopify |
| Contabilidad | Gastos e ingresos con IVA, facturas adjuntas (foto o PDF), cuentas entre socios («quién debe a quién») y exportación CSV para la gestoría |
| Proveedores | Estado de cada negociación, condiciones, contactos y siguiente paso |
| Contenido | Ideas y publicaciones para redes, de idea a publicado |
| Estadísticas | Ventas de Shopify y visitas de Google Analytics: cifras clave, ventas y visitantes por día, de dónde viene la gente, embudo de compra, páginas y productos. Funciona en las dos direcciones: la de Vercel pide los datos a la de Cloudflare |
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

## Estadísticas (Cloudflare Pages, gratis y sin tarjeta)
La pestaña «Estadísticas» pide los datos a `functions/api/estadisticas.js`, una función que se ejecuta en Cloudflare Pages. Comprueba que quien pregunta ha entrado con el código del equipo, lee Shopify y Google Analytics con claves que solo están en Cloudflare y guarda la respuesta 10 minutos. En Vercel esa función no existe: el panel de Vercel pide los datos a https://landez-panel.pages.dev, que solo acepta peticiones de las direcciones del panel (lista ORIGENES en la función).

### 1. Publicar el panel en Cloudflare
1. Crea una cuenta gratuita en https://dash.cloudflare.com/sign-up con `contacto@landezdescanso.es`. No pide tarjeta.
2. **Workers y Pages → Crear → Pages → Conectar con Git →** autoriza GitHub y elige el repositorio `dormily-panel`.
3. Ajustes de compilación: **Ajuste predefinido: Ninguno**, **Comando de compilación: vacío**, **Directorio de salida: `/`**. Pulsa **Guardar e implementar**.
4. Queda en https://landez-panel.pages.dev. Si Firebase no deja entrar desde ella, añade ese dominio en **Firebase → Authentication → Configuración → Dominios autorizados**.

### 2. Claves de Shopify (`SHOPIFY_CLIENT_ID` y `SHOPIFY_CLIENT_SECRET`)
Shopify ya no deja crear «apps personalizadas» desde la tienda; se hacen en el Dev Dashboard.
1. https://dev.shopify.com/dashboard → **Apps → Crear app**, con el nombre «Panel Landez».
2. En la versión de la app, en **Permisos (scopes)**, pon `read_orders`, `read_products` y `read_reports`, y publica la versión. `read_reports` da las visitas, el embudo y las fuentes que cuenta Shopify; sin él, la pestaña muestra las de Analytics.
3. **Instalar** la app en la tienda Landez Descanso.
4. En **Configuración** de la app copia el **ID de cliente** y el **secreto de cliente**. La función los cambia sola por un token que dura 24 horas.

Si algún día tenéis un token fijo de una app antigua, también vale: ponlo como `SHOPIFY_TOKEN`.

### 3. Clave de Google Analytics (`GA_CLAVE_JSON`)
1. https://console.cloud.google.com con la cuenta `contacto@landezdescanso.es` → crea un proyecto «Panel Landez». No hace falta activar la facturación.
2. **APIs y servicios → Biblioteca →** busca **Google Analytics Data API** → **Habilitar**.
3. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio** con el nombre «panel-estadisticas». No le des roles.
4. En la cuenta creada: **Claves → Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo `.json`.
5. En Google Analytics: **Administrar → Gestión de acceso a la propiedad → + → Añadir usuarios →** el correo de la cuenta de servicio (termina en `iam.gserviceaccount.com`), rol **Lector**, sin notificar.

### 3 bis. Token de Meta (`META_TOKEN`, opcional)
Para seguidores y alcance de Instagram, seguidores de Facebook y lo que recibe el píxel. Hace falta un «usuario del sistema» del portfolio Landez Descanso con acceso a la página, a Instagram y al conjunto de datos, y un token suyo con los permisos `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights` y `business_management`. Sin él, la pestaña avisa de que Meta está sin conectar y el resto funciona igual.

### 4. Pegar las claves en Cloudflare
En el proyecto de Pages: **Configuración → Variables y secretos → Agregar**, tipo **Secreto**, en **Producción**:
| Nombre | Valor |
|---|---|
| `SHOPIFY_CLIENT_ID` | El ID de cliente de la app de Shopify |
| `SHOPIFY_CLIENT_SECRET` | El secreto de cliente de la app de Shopify |
| `GA_CLAVE_JSON` | Todo el contenido del archivo `.json` de Google, tal cual |
| `META_TOKEN` | El token del usuario del sistema de Meta (opcional) |

Después **Implementaciones → Volver a implementar** la última. Borra el `.json` de tu ordenador cuando esté pegado. Ni las claves ni el archivo van nunca a GitHub.

Valores que ya vienen puestos y solo hay que cambiar si cambia algo: `SHOPIFY_TIENDA` (`de800h-ms.myshopify.com`), `SHOPIFY_VERSION` (`2026-10`), `GA_PROPIEDAD` (`564410947`), `FIREBASE_PROYECTO` (`dormily-panel`), `CUENTA_EQUIPO` (`panel@dormily.es`), `META_VERSION` (`v23.0`), `META_PAGINA` (`1412410575299118`), `META_DATASET` (`3314865168719686`), `META_PORTFOLIO` (`1048814831506388`), `META_IG` (vacío: se toma el Instagram unido a la página o, si no, el del portfolio).

## Archivos
| Archivo | Para qué |
|---|---|
| `functions/api/estadisticas.js` | Datos de la pestaña Estadísticas (Shopify, Google Analytics y Meta), en Cloudflare Pages |
| `index.html` | La página: entrada, tareas, calendario y notas |
| `gestion.js` | Sección Gestión: productos, clientes y el editor de presupuestos, pedidos y albaranes |
| `documento.js` | Plantilla A4 de los documentos (cabecera y pie en cada hoja, totales, firma) |
| `plantilla.html` | La plantilla con datos inventados, para verla o imprimirla |
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

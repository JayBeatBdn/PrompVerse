# PrompVerse

PrompVerse es un gestor de prompts temáticos con interfaz tipo dashboard. Ahora está disponible como plugin para WordPress, de modo que cada usuario autenticado puede mantener su propio espacio de trabajo con persistencia en el servidor.

## ¿Qué incluye el repositorio?

- **`wp-plugin/`**: plugin completo de WordPress con el frontend original empaquetado dentro de un Shadow DOM para evitar conflictos de estilos.
- **Frontend vanilla** (`src/`, `styles.css`, `index.html`) usado como base del plugin.

## Características principales

- ✅ Agrupa los prompts en colecciones y muestra los mensajes como una conversación (sistema, usuario, asistente).
- ✅ Guardado automático en el servidor para cada usuario autenticado de WordPress.
- ✅ Invitados trabajan en modo sesión: al salir de la página sus datos se descartan.
- ✅ UI moderna con feedback visual del estado de guardado.
- 🔐 El backend expone endpoints REST propios (`/wp-json/prompverse/v1/workspace`) protegidos mediante autenticación nativa de WordPress.

## Instalación del plugin

1. Copia la carpeta `wp-plugin` dentro del directorio `wp-content/plugins/` de tu instalación de WordPress y renómbrala si lo deseas (por ejemplo, `prompverse`).
2. Activa "PrompVerse" desde el panel **Plugins** en el administrador de WordPress.
3. Inserta el shortcode `[prompverse]` dentro de una página o entrada para mostrar el dashboard.

> El plugin no tiene dependencias externas ni requiere procesos de build. Todos los assets están listos dentro de `wp-plugin/assets/`.

## Comportamiento según el usuario

- **Usuario autenticado**: los cambios se guardan mediante la REST API y se almacenan como metadatos privados del usuario. El indicador de guardado mostrará la marca de tiempo relativa y exacta.
- **Usuario invitado**: la interfaz funciona de forma local y el indicador muestra "Sesión temporal · los datos se perderán al salir". No se realizan llamadas a la API ni se guarda nada en el servidor.

## Desarrollo y estructura

- `wp-plugin/prompverse.php`: bootstrap del plugin. Registra el shortcode `[prompverse]`, expone la configuración inicial para el frontend y monta los endpoints REST.
- `wp-plugin/includes/class-prompverse-rest.php`: controladores REST para cargar y persistir el workspace por usuario.
- `wp-plugin/assets/js/prompverse.js`: lógica de la interfaz. Se monta dentro de un Shadow DOM, consume los endpoints y gestiona el estado de guardado.
- `wp-plugin/assets/css/prompverse.css`: estilos reutilizados del proyecto original.

### Endpoints REST

- `GET /wp-json/prompverse/v1/workspace`  
  Devuelve el workspace del usuario autenticado (o `null` si no hay datos). Para invitados indica que no existe persistencia.

- `POST /wp-json/prompverse/v1/workspace`  
  Actualiza el workspace del usuario autenticado. Requiere cabecera `X-WP-Nonce` válida (se inyecta automáticamente desde el frontend del plugin).

## Notas de compatibilidad

- El frontend usa `fetch`, `async/await` y `Shadow DOM`, por lo que necesita navegadores modernos (Chrome/Edge 79+, Firefox 68+, Safari 13+).
- Para entornos multisitio, el plugin funciona por usuario, sin exponer datos entre sitios.

## Desarrollo local

Puedes seguir utilizando el HTML original (`index.html`) para experimentar con la UI en modo estático. Las mejoras que hagas en `src/main.js` o `styles.css` pueden sincronizarse con el plugin copiando los cambios a `wp-plugin/assets/js/prompverse.js` y `wp-plugin/assets/css/prompverse.css`.

/**
 * FERIA CIENTÍFICA
 * Carga del contenido público editable
 * Instituto Benigno Jiménez Garay
 */

(async function () {
  "use strict";

  const endpoint = window.FERIA_API_URL;
  const edicion = window.FERIA_CONFIG?.EDICION || 2027;

  if (!endpoint) {
    console.warn("No se ha configurado la URL de la API.");
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        accion: "obtenerContenido",
        edicion
      })
    });

    if (!response.ok) {
      throw new Error("No se pudo conectar con el servidor.");
    }

    const data = await response.json();

    if (!data.ok || !data.contenido) {
      console.warn("No hay contenido público disponible.");
      return;
    }

    const content = data.contenido;

    function getContent(key) {
      return content[key] ??
        content[`PUBLICO_${key.toUpperCase()}`] ??
        "";
    }

    function setText(selector, value) {
      const element = document.querySelector(selector);

      if (
        element &&
        typeof value === "string" &&
        value.trim()
      ) {
        element.textContent = value;
      }
    }

    setText('[data-site="titulo"]', getContent("titulo"));
    setText('[data-site="institucion"]', getContent("institucion"));
    setText('[data-site="subtitulo"]', getContent("subtitulo"));
    setText('[data-site="descripcion"]', getContent("descripcion"));
    setText('[data-site="aviso"]', getContent("aviso"));

    /* FECHA DE CIERRE */

    const dateElement = document.querySelector('[data-site="fecha"]');
    const fecha = getContent("fechaCierre");

    if (dateElement && typeof fecha === "string") {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (match) {
        const year = match[1];
        const month = Number(match[2]);
        const day = Number(match[3]);

        const months = [
          "enero", "febrero", "marzo", "abril",
          "mayo", "junio", "julio", "agosto",
          "septiembre", "octubre", "noviembre", "diciembre"
        ];

        if (month >= 1 && month <= 12) {
          dateElement.textContent =
            `${Number(day)} de ${months[month - 1]} de ${year}`;
        }
      }
    }

    /* COLORES INSTITUCIONALES */

    const root = document.documentElement;
    const primary = getContent("colorPrimario");
    const secondary = getContent("colorSecundario");

    if (/^#[0-9a-f]{6}$/i.test(primary)) {
      root.style.setProperty("--verde-institucional", primary);
    }

    if (/^#[0-9a-f]{6}$/i.test(secondary)) {
      root.style.setProperty("--verde-secundario", secondary);
    }

    /* VALIDACIÓN DE IMÁGENES */

    function validImageUrl(value) {
      if (typeof value !== "string" || !value.trim()) {
        return null;
      }

      try {
        const url = new URL(value, window.location.href);

        if (
          url.protocol !== "https:" &&
          url.protocol !== "http:"
        ) {
          return null;
        }

        return url.href;
      } catch {
        return null;
      }
    }

    /* LOGOTIPO */

    const logoUrl = validImageUrl(getContent("logoUrl"));

    if (logoUrl) {
      const mark = document.querySelector(".brand-mark");

      if (mark) {
        const image = document.createElement("img");

        image.src = logoUrl;
        image.alt = "Logotipo institucional";
        image.style.cssText =
          "max-width:100%;max-height:100%;object-fit:contain";

        image.onerror = () => image.remove();

        mark.replaceChildren(image);
      }
    }

    /* IMAGEN DE PORTADA */

    const portadaUrl = validImageUrl(getContent("imagenPortada"));

    if (portadaUrl) {
      const portada =
        document.querySelector(".portal-hero") ||
        document.querySelector(".intro");

      if (portada) {
        portada.style.backgroundImage =
          `linear-gradient(90deg,rgba(255,255,255,.94),rgba(255,255,255,.78)),url("${portadaUrl}")`;

        portada.style.backgroundSize = "cover";
        portada.style.backgroundPosition = "center";
      }
    }

  } catch (error) {
    console.warn(
      "No se pudo cargar el contenido editable:",
      error
    );
  }
})();

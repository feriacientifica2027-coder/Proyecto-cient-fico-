
/**
 * FERIA CIENTÍFICA 2027
 * Carga del contenido público editable
 * Instituto Benigno Jiménez Garay
 */

(async function () {
  "use strict";

  const endpoint = window.FERIA_API_URL;

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
        accion: "obtenerContenido"
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

    // Actualización segura de textos
    const setText = (selector, value) => {
      const element = document.querySelector(selector);

      if (
        element &&
        typeof value === "string" &&
        value.trim()
      ) {
        element.textContent = value;
      }
    };

    setText('[data-site="titulo"]', content.titulo);
    setText('[data-site="institucion"]', content.institucion);
    setText('[data-site="subtitulo"]', content.subtitulo);
    setText('[data-site="descripcion"]', content.descripcion);
    setText('[data-site="aviso"]', content.aviso);

    // Fecha de cierre
    const dateElement = document.querySelector(
      '[data-site="fecha"]'
    );

    if (
      dateElement &&
      typeof content.fechaCierre === "string"
    ) {
      const match = content.fechaCierre.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

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

    // Colores institucionales
    const root = document.documentElement;

    if (/^#[0-9a-f]{6}$/i.test(content.colorPrimario || "")) {
      root.style.setProperty(
        "--azul",
        content.colorPrimario
      );
    }

    if (/^#[0-9a-f]{6}$/i.test(content.colorSecundario || "")) {
      root.style.setProperty(
        "--rojo",
        content.colorSecundario
      );
    }

    // Validación de direcciones de imágenes
    const validImageUrl = (value) => {
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
    };

    // Logotipo institucional
    const logoUrl = validImageUrl(content.logoUrl);

    if (logoUrl) {
      const mark = document.querySelector(".brand-mark");

      if (mark) {
        const image = document.createElement("img");

        image.src = logoUrl;
        image.alt = "Logotipo institucional";
        image.style.cssText =
          "max-width:100%;max-height:100%;object-fit:contain";

        image.onerror = () => {
          image.remove();
        };

        mark.replaceChildren(image);
      }
    }

    // Imagen de portada
    const portadaUrl = validImageUrl(content.imagenPortada);

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

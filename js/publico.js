(async function () {
  const endpoint = window.FERIA_API_URL;
  if (!endpoint) return;

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

    const data = await response.json();

    if (!data.ok || !data.contenido) return;

    const content = data.contenido;

    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element && value) {
        element.textContent = value;
      }
    };

    setText('[data-site="titulo"]', content.titulo);
    setText('[data-site="institucion"]', content.institucion);
    setText('[data-site="subtitulo"]', content.subtitulo);
    setText('[data-site="descripcion"]', content.descripcion);
    setText('[data-site="aviso"]', content.aviso);

    // Fecha de cierre
    const dateElement = document.querySelector('[data-site="fecha"]');

    if (dateElement && content.fechaCierre) {
      const parts = content.fechaCierre.split("-");
      const months = [
        "enero", "febrero", "marzo", "abril",
        "mayo", "junio", "julio", "agosto",
        "septiembre", "octubre", "noviembre", "diciembre"
      ];

      dateElement.textContent =
        `${Number(parts[2])} de ${months[Number(parts[1]) - 1]} de ${parts[0]}`;
    }

    // Colores del sitio
    const root = document.documentElement;

    if (/^#[0-9a-f]{6}$/i.test(content.colorPrimario || "")) {
      root.style.setProperty("--azul", content.colorPrimario);
    }

    if (/^#[0-9a-f]{6}$/i.test(content.colorSecundario || "")) {
      root.style.setProperty("--rojo", content.colorSecundario);
    }

    // Logotipo
    if (content.logoUrl) {
      const mark = document.querySelector(".brand-mark");

      if (mark) {
        mark.innerHTML = "";

        const image = document.createElement("img");
        image.src = content.logoUrl;
        image.alt = "Logotipo";
        image.style.cssText =
          "max-width:100%;max-height:100%;object-fit:contain";

        mark.appendChild(image);
      }
    }

    // Imagen de portada
    if (content.imagenPortada) {
      const intro = document.querySelector(".intro");

      if (intro) {
        intro.style.backgroundImage =
          `linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.78)),url("${content.imagenPortada.replace(/["\\]/g, "")}")`;

        intro.style.backgroundSize = "cover";
        intro.style.backgroundPosition = "center";
        intro.style.padding = "24px";
      }
    }

  } catch (error) {
    console.warn(
      "No se pudo cargar el contenido editable:",
      error
    );
  }
})();

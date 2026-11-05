
/**
 * FERIA CIENTÍFICA 2027
 * Sistema de inscripción de proyectos
 * Instituto Benigno Jiménez Garay
 */

const AREAS = [
  ["Biología", "BIO", "Estudio de los seres vivos y sus procesos."],
  ["Ciencias Ambientales", "CAM", "Ambiente, ecosistemas y sostenibilidad."],
  ["Ciencias de la Computación", "CCO", "Computación, programación y datos."],
  ["Ciencias Sociales y del Comportamiento", "CSC", "Sociedad y comportamiento humano."],
  ["Física y Matemática", "FMA", "Fenómenos físicos y modelos matemáticos."],
  ["Ingeniería y Tecnología", "INY", "Diseño, procesos y soluciones tecnológicas."],
  ["Química", "QUI", "Materia, composición y transformaciones."],
  ["Salud y Medicina", "SYM", "Salud, prevención y ciencias médicas."]
];

const areaBox = document.getElementById("areas");
const form = document.getElementById("registroForm");
const resumen = document.getElementById("resumen");
const msg = document.getElementById("formMessage");
const btn = document.getElementById("submitBtn");

let enviando = false;

/* =========================================
   ÁREAS TEMÁTICAS
========================================= */

if (areaBox) {
  AREAS.forEach(([name, code, desc]) => {
    const label = document.createElement("label");
    label.className = "area-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "areaRadio";
    radio.value = name;
    radio.required = true;

    const content = document.createElement("span");

    const title = document.createElement("strong");
    title.textContent = name;

    const description = document.createElement("small");
    description.textContent = desc;

    content.append(title, description);
    label.append(radio, content);

    radio.addEventListener("change", () => {
      document.getElementById("area").value = name;

      document.querySelectorAll(".area-option").forEach(option => {
        option.classList.remove("selected");
      });

      label.classList.add("selected");
    });

    areaBox.appendChild(label);
  });
}

/* =========================================
   UTILIDADES
========================================= */

function words(text) {
  return text.trim()
    ? text.trim().split(/\s+/).length
    : 0;
}

function showMessage(message, type = "error") {
  if (!msg) return;

  msg.textContent = message;
  msg.className = `message ${type}`;
}

function clearMessage() {
  if (!msg) return;

  msg.textContent = "";
  msg.className = "message";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

/* =========================================
   CONTADOR DE PALABRAS
========================================= */

if (resumen) {
  resumen.addEventListener("input", () => {
    const counter = document.getElementById("wordCount");

    if (counter) {
      counter.textContent = words(resumen.value);
    }

    if (words(resumen.value) > 250) {
      resumen.setCustomValidity(
        "El resumen no puede superar las 250 palabras."
      );
    } else {
      resumen.setCustomValidity("");
    }
  });
}

/* =========================================
   CONEXIÓN CON GOOGLE APPS SCRIPT
========================================= */

async function api(payload) {
  if (
    !window.FERIA_API_URL ||
    window.FERIA_API_URL.includes("PEGA_AQUI")
  ) {
    throw new Error(
      "No se ha configurado la conexión con el sistema de inscripciones."
    );
  }

  let response;

  try {
    response = await fetch(window.FERIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(
      "No fue posible conectar con el servidor. Comprueba tu conexión a internet e inténtalo nuevamente."
    );
  }

  if (!response.ok) {
    throw new Error(
      "El servidor no pudo procesar la solicitud. Inténtalo nuevamente."
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(
      "El servidor respondió con un formato inesperado. Contacta con la administración de la feria."
    );
  }
}

/* =========================================
   VALIDACIÓN DEL FORMULARIO
========================================= */

function validateForm(data, file) {
  const area = document.getElementById("area").value;
  const correo = String(data.correo || "").trim();
  const correoConfirmacion = document
    .getElementById("correoConfirmacion")
    .value.trim();

  if (!area) {
    throw new Error("Selecciona un área temática.");
  }

  if (words(data.resumen || "") > 250) {
    throw new Error(
      "El resumen supera el máximo permitido de 250 palabras."
    );
  }

  if (correo.toLowerCase() !== correoConfirmacion.toLowerCase()) {
    throw new Error("Los correos electrónicos no coinciden.");
  }

  if (!file) {
    throw new Error("Adjunta el anteproyecto.");
  }

  const maxSize = 20 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      "El archivo supera el límite permitido de 20 MB."
    );
  }

  if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
    throw new Error(
      "El formato del archivo no está permitido. Utiliza PDF, DOC o DOCX."
    );
  }

  if (!document.getElementById("declaracion").checked) {
    throw new Error(
      "Debes aceptar la declaración para continuar."
    );
  }

  return area;
}

/* =========================================
   LECTURA DEL ARCHIVO
========================================= */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string" || !result.includes(",")) {
        reject(
          new Error("No se pudo procesar el archivo seleccionado.")
        );
        return;
      }

      resolve(result.split(",")[1]);
    };

    reader.onerror = () => {
      reject(
        new Error("Ocurrió un problema al leer el anteproyecto.")
      );
    };

    reader.onabort = () => {
      reject(
        new Error("La lectura del archivo fue cancelada.")
      );
    };

    reader.readAsDataURL(file);
  });
}

/* =========================================
   RESTAURAR BOTÓN
========================================= */

function restoreButton() {
  enviando = false;

  if (btn) {
    btn.disabled = false;
    btn.textContent = "Enviar inscripción";
  }
}

/* =========================================
   ENVÍO DE INSCRIPCIÓN
========================================= */

if (form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (enviando) return;

    clearMessage();

    if (!form.reportValidity()) return;

    try {
      const data = Object.fromEntries(
        new FormData(form).entries()
      );

      const file = document.getElementById("archivo").files[0];

      data.area = validateForm(data, file);

      // Bloquea nuevos envíos antes de iniciar operaciones asíncronas.
      enviando = true;
      btn.disabled = true;
      btn.textContent = "Preparando inscripción…";

      const base64 = await fileToBase64(file);

      btn.textContent = "Enviando inscripción…";

      const response = await api({
        ...data,
        accion: "registrar",
        archivoNombre: file.name,
        archivoMime: file.type || "application/octet-stream",
        archivoBase64: base64
      });

      if (!response || response.ok !== true) {
        throw new Error(
          response?.error ||
          "No se pudo completar la inscripción."
        );
      }

      const codigo = escapeHtml(response.codigo);

      form.innerHTML = `
        <div class="result-card">
          <p class="eyebrow">Inscripción recibida</p>

          <h2>Registro completado</h2>

          <p>
            La inscripción de tu proyecto fue recibida correctamente.
          </p>

          <p>El código asignado es:</p>

          <strong>${codigo}</strong>

          <p>
            Guarda este código para consultar posteriormente
            el estado de tu proyecto.
          </p>

          <p class="muted">
            Si el servicio de correo está habilitado,
            recibirás una confirmación en el correo registrado.
          </p>

          <a class="button secondary" href="consulta.html">
            Consultar proyecto
          </a>
        </div>
      `;

    } catch (error) {
      showMessage(
        error.message ||
        "Ocurrió un error inesperado al procesar la inscripción."
      );

      restoreButton();
    }
  });
}

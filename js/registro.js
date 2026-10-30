
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

AREAS.forEach(([name, code, desc]) => {
  const label = document.createElement("label");
  label.className = "area-option";

  label.innerHTML = `
    <input type="radio" name="areaRadio" value="${name}">
    <span>
      <strong>${name}</strong>
      <small>${desc}</small>
    </span>
  `;

  label.querySelector("input").addEventListener("change", () => {
    document.getElementById("area").value = name;

    document.querySelectorAll(".area-option").forEach(x =>
      x.classList.remove("selected")
    );

    label.classList.add("selected");
  });

  areaBox.appendChild(label);
});

const form = document.getElementById("registroForm");
const resumen = document.getElementById("resumen");
const msg = document.getElementById("formMessage");
const btn = document.getElementById("submitBtn");

function words(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

resumen.addEventListener("input", () => {
  document.getElementById("wordCount").textContent =
    words(resumen.value);
});

async function api(payload) {
  if (
    !window.FERIA_API_URL ||
    window.FERIA_API_URL.includes("PEGA_AQUI")
  ) {
    throw new Error(
      "Falta configurar la URL de Google Apps Script en js/config.js."
    );
  }

  const response = await fetch(window.FERIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  return response.json();
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  msg.textContent = "";
  msg.className = "message";

  if (!form.reportValidity()) return;

  const data = Object.fromEntries(
    new FormData(form).entries()
  );

  data.area = document.getElementById("area").value;

  if (!data.area) {
    msg.textContent = "Selecciona un área temática.";
    return;
  }

  if (words(data.resumen) > 250) {
    msg.textContent =
      "El resumen supera el máximo de 250 palabras.";
    return;
  }

  const correoConfirmacion =
    document.getElementById("correoConfirmacion").value.trim();

  if (
    data.correo.toLowerCase() !==
    correoConfirmacion.toLowerCase()
  ) {
    msg.textContent = "Los correos electrónicos no coinciden.";
    return;
  }

  const file = document.getElementById("archivo").files[0];

  if (!file) {
    msg.textContent = "Adjunta el anteproyecto.";
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    msg.textContent = "El archivo supera el límite de 20 MB.";
    return;
  }

  if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
    msg.textContent = "Formato no permitido.";
    return;
  }

  if (!document.getElementById("declaracion").checked) {
    msg.textContent = "Debes aceptar la declaración.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando…";

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result.split(",")[1]);
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await api({
      ...data,
      accion: "registrar",
      archivoNombre: file.name,
      archivoMime: file.type || "application/octet-stream",
      archivoBase64: base64
    });

    if (!response.ok) {
      throw new Error(
        response.error || "No se pudo completar el registro."
      );
    }

    form.innerHTML = `
      <div class="result-card">
        <p class="eyebrow">Inscripción recibida</p>
        <h2>Registro completado</h2>
        <p>El código asignado a tu proyecto es:</p>
        <strong>${response.codigo}</strong>
        <p>Guarda este código para consultar el estado de tu proyecto.</p>
        <p class="muted">
          Se envió una confirmación al correo registrado,
          si el servicio de correo está habilitado.
        </p>
        <a class="button secondary" href="consulta.html">
          Consultar proyecto
        </a>
      </div>
    `;

  } catch (error) {
    msg.textContent = error.message;
    btn.disabled = false;
    btn.textContent = "Enviar inscripción";
  }
});

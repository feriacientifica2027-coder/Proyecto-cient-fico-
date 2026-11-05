
/**
 * FERIA CIENTÍFICA 2027
 * Consulta y seguimiento de proyectos
 * Instituto Benigno Jiménez Garay
 */

const consultaForm = document.getElementById("consultaForm");
const consultaResult = document.getElementById("consultaResult");

let consultando = false;

/* =========================================
   UTILIDADES
========================================= */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function mostrarResultado(message, type = "") {
  consultaResult.className = "result-box";

  if (type) {
    consultaResult.classList.add(type);
  }

  consultaResult.textContent = message;
}

/* =========================================
   CONEXIÓN CON GOOGLE APPS SCRIPT
========================================= */

async function consultarAPI(payload) {
  if (
    !window.FERIA_API_URL ||
    window.FERIA_API_URL.includes("PEGA_AQUI")
  ) {
    throw new Error(
      "El sistema de consultas aún no está configurado."
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
      "No fue posible conectar con el servidor. Comprueba tu conexión e inténtalo nuevamente."
    );
  }

  if (!response.ok) {
    throw new Error(
      "El servidor no pudo procesar la consulta. Inténtalo más tarde."
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(
      "El servidor respondió con un formato inesperado."
    );
  }
}

/* =========================================
   MOSTRAR INFORMACIÓN DEL PROYECTO
========================================= */

function mostrarProyecto(proyecto) {
  if (!proyecto || typeof proyecto !== "object") {
    throw new Error(
      "No se recibieron los datos del proyecto correctamente."
    );
  }

  consultaResult.className = "result-box";

  consultaResult.innerHTML = `
    <div class="result-card">

      <p class="eyebrow">Resultado de la consulta</p>

      <h2>Proyecto encontrado</h2>

      <p>
        <strong>Código:</strong>
        ${escapeHtml(proyecto.codigo)}
      </p>

      <p>
        <strong>Título:</strong>
        ${escapeHtml(proyecto.titulo)}
      </p>

      <p>
        <strong>Área temática:</strong>
        ${escapeHtml(proyecto.area)}
      </p>

      <p>
        <strong>Estado:</strong>
        ${escapeHtml(proyecto.estado)}
      </p>

      <div class="observaciones">
        <strong>Observaciones:</strong>
        <p>
          ${escapeHtml(
            proyecto.observaciones ||
            "No hay observaciones registradas actualmente."
          )}
        </p>
      </div>

      <p class="muted">
        Consulta periódicamente esta sección para conocer
        las actualizaciones de tu inscripción.
      </p>

    </div>
  `;
}

/* =========================================
   EVENTO DE CONSULTA
========================================= */

if (consultaForm && consultaResult) {

  consultaForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (consultando) return;

    const codigoInput = document.getElementById("codigo");
    const correoInput = document.getElementById("correo");

    const button = consultaForm.querySelector(
      'button[type="submit"]'
    );

    const codigo = codigoInput.value.trim().toUpperCase();
    const correo = correoInput.value.trim().toLowerCase();

    /* Validación de campos */

    if (!codigo || !correo) {
      mostrarResultado(
        "Completa el código y el correo electrónico."
      );
      return;
    }

    /* Se conserva temporalmente el formato actual del sistema */

    if (!/^[A-Z]{2,3}-\d{4}$/.test(codigo)) {
      mostrarResultado(
        "El código debe tener el formato BIO-0001."
      );
      return;
    }

    if (!correoInput.validity.valid) {
      mostrarResultado(
        "Introduce un correo electrónico válido."
      );
      return;
    }

    consultando = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Consultando...";
    }

    mostrarResultado("Buscando información del proyecto...");

    try {

      const data = await consultarAPI({
        accion: "consultar",
        codigo: codigo,
        correo: correo
      });

      if (!data || data.ok !== true) {
        throw new Error(
          data?.error ||
          "No se encontró un proyecto con esos datos."
        );
      }

      mostrarProyecto(data.proyecto);

    } catch (error) {

      mostrarResultado(
        error.message ||
        "Ocurrió un error al consultar el proyecto."
      );

    } finally {

      consultando = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Consultar";
      }
    }
  });
}

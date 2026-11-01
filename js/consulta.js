document.getElementById("consultaForm").addEventListener("submit", async event => {
  event.preventDefault();

  const output = document.getElementById("consultaResult");
  const codigo = document.getElementById("codigo").value.trim().toUpperCase();
  const correo = document.getElementById("correo").value.trim().toLowerCase();
  const button = event.submitter;

  // Validar los campos
  if (!codigo || !correo) {
    output.textContent = "Completa el código y el correo electrónico.";
    return;
  }

  // Validar formato del código
  if (!/^[A-Z]{2,3}-\d{4}$/.test(codigo)) {
    output.textContent = "El código debe tener el formato BIO-0001.";
    return;
  }

  output.textContent = "Consultando proyecto...";

  if (button) {
    button.disabled = true;
    button.textContent = "Consultando...";
  }

  try {
    if (
      !window.FERIA_API_URL ||
      window.FERIA_API_URL.includes("PEGA_AQUI")
    ) {
      throw new Error("El sistema aún no está configurado.");
    }

    const response = await fetch(window.FERIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        accion: "consultar",
        codigo: codigo,
        correo: correo
      })
    });

    if (!response.ok) {
      throw new Error("No se pudo conectar con el servidor. Intenta nuevamente.");
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(
        data.error || "No se encontró el proyecto."
      );
    }

    const proyecto = data.proyecto;

    output.innerHTML = `
      <div class="result-card">
        <strong>${escapeHtml(proyecto.codigo)}</strong>

        <p>
          <b>${escapeHtml(proyecto.titulo)}</b>
        </p>

        <p>
          Área: ${escapeHtml(proyecto.area)}
        </p>

        <p>
          Estado:
          <b>${escapeHtml(proyecto.estado)}</b>
        </p>

        <p class="muted">
          ${escapeHtml(
            proyecto.observaciones ||
            "Sin observaciones registradas."
          )}
        </p>
      </div>
    `;

  } catch (error) {
    output.textContent = error.message;

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Consultar";
    }
  }
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

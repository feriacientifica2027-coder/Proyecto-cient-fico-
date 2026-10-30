
document.getElementById("consultaForm").addEventListener("submit", async event => {
  event.preventDefault();

  const output = document.getElementById("consultaResult");
  const codigo = document.getElementById("codigo").value.trim().toUpperCase();

  output.textContent = "Consultando…";

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
        codigo: codigo
      })
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "No se encontró el proyecto.");
    }

    output.innerHTML = `
      <div class="result-card">
        <strong>${escapeHtml(data.proyecto.codigo)}</strong>
        <p><b>${escapeHtml(data.proyecto.titulo)}</b></p>
        <p>Área: ${escapeHtml(data.proyecto.area)}</p>
        <p>Estado: <b>${escapeHtml(data.proyecto.estado)}</b></p>
        <p class="muted">
          ${escapeHtml(data.proyecto.observaciones || "Sin observaciones registradas.")}
        </p>
      </div>
    `;

  } catch (error) {
    output.textContent = error.message;
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

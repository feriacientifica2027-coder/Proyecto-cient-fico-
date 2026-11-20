/**
 * Consulta de proyectos e informes
 * Feria Científica — Instituto Benigno Jiménez Garay
 */

"use strict";

const consultaForm = document.getElementById("consultaForm");
const consultaResult = document.getElementById("consultaResult");

let consultando = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function mostrarResultado(html, tipo = "") {
  consultaResult.className = "result-box";
  if (tipo) consultaResult.classList.add(tipo);
  consultaResult.innerHTML = html;
}

async function consultarAPI(payload) {
  const endpoint = window.FERIA_API_URL;
  if (!endpoint) throw new Error("No se ha configurado la conexión con el servidor.");

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("No fue posible conectar con el servidor. Comprueba tu conexión.");
  }

  if (!response.ok) throw new Error("El servidor no pudo procesar la consulta.");
  const data = await response.json();
  if (!data || typeof data !== "object") throw new Error("La respuesta del servidor no es válida.");
  return data;
}

function mostrarProyecto(p) {
  const informeEstado = p.informeEstado || "Pendiente";
  const puedeEntregar = p.puedeEntregar === true;

  const estadosInforme = {
    "Pendiente": "Todavía no se ha recibido un informe final.",
    "Recibido": "El informe fue recibido correctamente.",
    "Corrección solicitada": "Hay observaciones que debes revisar. La administración debe habilitar la nueva entrega.",
    "Habilitado para corrección": "La administración habilitó una nueva entrega del informe.",
    "Aceptado": "El informe final fue aceptado."
  };

  const informeHtml = `
    <div class="observaciones">
      <h3>Informe final</h3>
      <p><strong>Estado:</strong> ${escapeHtml(informeEstado)}</p>
      <p>${escapeHtml(estadosInforme[informeEstado] || "Consulta las indicaciones enviadas por la administración.")}</p>
      <p><strong>Versión recibida:</strong> ${escapeHtml(p.informeVersion || 0)}</p>
      ${p.ultimaVersion ? `<p><strong>Último archivo:</strong> ${escapeHtml(p.ultimaVersion.nombre)}</p>` : ""}
      ${p.informeObservaciones ? `<p><strong>Observaciones:</strong> ${escapeHtml(p.informeObservaciones)}</p>` : ""}
      ${puedeEntregar ? `
        <hr>
        <h3>Entrega del informe final</h3>
        <form id="informeForm">
          <label for="informeArchivo">Archivo PDF</label>
          <input id="informeArchivo" type="file" accept="application/pdf,.pdf" required>
          <button class="button primary" type="submit">Enviar informe final</button>
          <p id="informeMessage" class="message" aria-live="polite"></p>
        </form>
      ` : ""}
    </div>
  `;

  mostrarResultado(`
    <article class="result-card">
      <p class="eyebrow">Resultado de la consulta</p>
      <h2>Proyecto encontrado</h2>
      <p><strong>Código:</strong> ${escapeHtml(p.codigo)}</p>
      <p><strong>Edición:</strong> ${escapeHtml(p.edicion)}</p>
      <p><strong>Turno:</strong> ${escapeHtml(p.turno === "TM" ? "Matutino" : "Vespertino")}</p>
      <p><strong>Título:</strong> «${escapeHtml(p.titulo)}»</p>
      <p><strong>Área:</strong> ${escapeHtml(p.area)}</p>
      <p><strong>Estado del proyecto:</strong> ${escapeHtml(p.estado)}</p>
      <div class="observaciones">
        <strong>Observaciones de la administración</strong>
        <p>${escapeHtml(p.observaciones || "No hay observaciones registradas.")}</p>
      </div>
      ${informeHtml}
    </article>
  `);

  const informeForm = document.getElementById("informeForm");
  if (informeForm) {
    informeForm.addEventListener("submit", enviarInforme);
  }
}

async function enviarInforme(event) {
  event.preventDefault();

  const file = document.getElementById("informeArchivo").files[0];
  const message = document.getElementById("informeMessage");

  if (!file) return;
  if (!/\.pdf$/i.test(file.name) || file.type !== "application/pdf") {
    message.textContent = "El informe final debe estar en formato PDF.";
    return;
  }

  // El envío Base64 directo no se considera una carga fiable para archivos grandes.
  // Se mantiene un límite provisional conservador hasta integrar carga por fragmentos.
  const limiteProvisional = 8 * 1024 * 1024;
  if (file.size > limiteProvisional) {
    message.textContent = "El archivo supera el límite provisional de esta versión. La carga de archivos grandes requiere habilitar el sistema de transferencia por fragmentos.";
    return;
  }

  const codigo = document.getElementById("codigo").value.trim().toUpperCase();
  const correo = document.getElementById("correo").value.trim().toLowerCase();

  const button = informeForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Enviando…";
  message.textContent = "Preparando el archivo…";

  try {
    const base64 = await leerBase64(file);
    const data = await consultarAPI({
      accion: "informeEntregar",
      codigo,
      correo,
      edicion: window.FERIA_CONFIG.EDICION,
      archivoNombre: file.name,
      archivoMime: file.type,
      archivoBase64: base64
    });

    if (!data.ok) throw new Error(data.error || "No se pudo entregar el informe.");
    message.textContent = `Informe recibido. Versión ${data.version}.`;
    message.className = "message success";
  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  } finally {
    button.disabled = false;
    button.textContent = "Enviar informe final";
  }
}

function leerBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      if (comma < 0) return reject(new Error("No se pudo leer el archivo."));
      resolve(result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo."));
    reader.readAsDataURL(file);
  });
}

if (consultaForm) {
  consultaForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (consultando) return;

    const codigo = document.getElementById("codigo").value.trim().toUpperCase();
    const correo = document.getElementById("correo").value.trim().toLowerCase();

    if (!/^(TM|TV)-(BIO|CAM|CCO|CSC|FMA|INY|QUI|SYM)-\d{3}$/.test(codigo)) {
      mostrarResultado("El código debe tener el formato TM-BIO-001 o TV-QUI-001.", "error");
      return;
    }

    consultando = true;
    const button = consultaForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Consultando…";
    mostrarResultado("Buscando información del proyecto…");

    try {
      const data = await consultarAPI({
        accion: "consultar",
        codigo,
        correo
      });

      if (!data.ok) throw new Error(data.error || "No se encontró el proyecto.");
      mostrarProyecto(data.proyecto);
    } catch (error) {
      mostrarResultado(escapeHtml(error.message), "error");
    } finally {
      consultando = false;
      button.disabled = false;
      button.textContent = "Consultar proyecto";
    }
  });
}

let token = "";
let role = "";
let selected = null;

const $ = id => document.getElementById(id);

async function call(accion, extra = {}) {
  if (!window.FERIA_API_URL || window.FERIA_API_URL.includes("PEGA_AQUI")) {
    throw new Error("Configura la URL de Apps Script en js/config.js.");
  }

  const response = await fetch(window.FERIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      accion,
      token,
      ...extra
    })
  });

  if (!response.ok) {
    throw new Error(`Error de conexión (${response.status}). Intenta nuevamente.`);
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida. Verifica Apps Script.");
  }

  return data;
}

// INICIO DE SESIÓN
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("loginMessage");
  message.textContent = "Verificando…";

  try {
    const data = await call("login", {
      correo: $("loginEmail").value.trim(),
      contrasena: $("loginPassword").value
    });

    if (!data.ok) {
      throw new Error(data.error || "No fue posible iniciar sesión.");
    }

    token = data.token;
    role = String(data.rol || "").toLowerCase();

    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("sessionLabel").textContent =
      `Sesión: ${data.nombre || $("loginEmail").value.trim()} · Rol: ${data.rol || "usuario"}`;

    const isAdmin =
      role === "administrador" ||
      role === "admin";

    $("usersPanel").classList.toggle("hidden", !isAdmin);
    $("massPanel").classList.toggle("hidden", !isAdmin);

    await refresh();

  } catch (error) {
    message.textContent =
      error.message || "Ocurrió un error al iniciar sesión.";
  }
});

// CERRAR SESIÓN
$("logoutBtn").addEventListener("click", () => {
  token = "";
  role = "";
  selected = null;

  $("dashboard").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");

  $("loginPassword").value = "";
  $("loginMessage").textContent = "";
  $("projectDetail").innerHTML = "";
  $("stats").innerHTML = "";
  $("projectsBody").innerHTML = "";
});

$("refreshBtn").addEventListener("click", refresh);

// ACTUALIZAR PROYECTOS
async function refresh() {
  const button = $("refreshBtn");

  button.disabled = true;

  try {
    const data = await call("listar");

    if (!data.ok) {
      throw new Error(data.error || "No se pudieron cargar los proyectos.");
    }

    const rows = Array.isArray(data.proyectos)
      ? data.proyectos
      : [];

    const stats = [
      ["Total", rows.length],
      ["Recibidos", rows.filter(x => x.estado === "Recibido").length],
      ["Aprobados", rows.filter(x => x.estado === "Aprobado").length],
      ["Rechazados", rows.filter(x => x.estado === "Rechazado").length]
    ];

    $("stats").innerHTML = stats.map(([label, value]) => `
      <div class="stat">
        <b>${value}</b>
        <span>${label}</span>
      </div>
    `).join("");

    $("projectsBody").innerHTML = rows.length
      ? rows.map(project => `
        <tr>
          <td><b>${esc(project.codigo)}</b></td>
          <td>${esc(project.area)}</td>
          <td>${esc(project.titulo)}</td>
          <td>${esc(project.lider)}</td>
          <td><span class="status">${esc(project.estado)}</span></td>
          <td>
            <button
              type="button"
              class="table-link"
              data-code="${esc(project.codigo)}">
              Abrir
            </button>
          </td>
        </tr>
      `).join("")
      : '<tr><td colspan="6">Todavía no hay proyectos registrados.</td></tr>';

    document.querySelectorAll("[data-code]").forEach(button => {
      button.addEventListener("click", () => {
        const project = rows.find(
          item => String(item.codigo) === button.dataset.code
        );

        if (project) {
          showDetail(project);
        }
      });
    });

  } catch (error) {
    alert(error.message || "No se pudieron actualizar los datos.");

  } finally {
    button.disabled = false;
  }
}

// DETALLE DEL PROYECTO
function showDetail(project) {
  selected = project;

  $("projectDetail").innerHTML = `
    <div class="detail-grid">

      ${[
        ["Código", project.codigo],
        ["Área", project.area],
        ["Título", project.titulo],
        ["Tipo", project.tipo],
        ["Líder", project.lider],
        ["Correo", project.correo],
        ["Grado / salón", `${project.grado || ""} · ${project.salon || ""}`],
        ["Asesor", project.asesor]
      ].map(([label, value]) => `
        <div>
          <b>${esc(label)}</b>
          ${esc(value)}
        </div>
      `).join("")}

      <div>
        <b>Archivo</b>
        ${
          project.archivoUrl
            ? `<a target="_blank" rel="noopener noreferrer"
                 href="${safeUrl(project.archivoUrl)}">
                 Abrir anteproyecto
               </a>`
            : "No disponible"
        }
      </div>

      <div>
        <b>Resumen</b>
        ${esc(project.resumen)}
      </div>

    </div>

    <div class="admin-actions">

      <label>Estado
        <select id="newStatus">
          <option>Recibido</option>
          <option>En revisión</option>
          <option>Aprobado</option>
          <option>Rechazado</option>
        </select>
      </label>

      <label>Observaciones
        <textarea id="obs" rows="2"
          placeholder="Observaciones para el equipo">${esc(project.observaciones || "")}</textarea>
      </label>

      <label class="check">
        <input type="checkbox" id="notify" checked>
        <span>Notificar al líder por correo si cambia el estado u observaciones</span>
      </label>

      <button class="button primary" id="saveStatus" type="button">
        Guardar evaluación
      </button>

    </div>

    <div id="saveMessage" class="message"
      role="status" aria-live="polite"></div>
  `;

  $("newStatus").value = project.estado || "Recibido";

  $("saveStatus").addEventListener("click", saveStatus);
}

// GUARDAR EVALUACIÓN
async function saveStatus() {
  if (!selected) return;

  const button = $("saveStatus");
  const message = $("saveMessage");

  button.disabled = true;
  message.textContent = "Guardando…";

  try {
    const data = await call("actualizar", {
      codigo: selected.codigo,
      estado: $("newStatus").value,
      observaciones: $("obs").value,
      notificar: $("notify").checked
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudo guardar la evaluación.");
    }

    message.textContent = data.notificado
      ? "Actualización guardada y correo enviado al líder."
      : "Actualización guardada.";

    await refresh();

  } catch (error) {
    message.textContent =
      error.message || "Ocurrió un error al guardar.";

  } finally {
    button.disabled = false;
  }
}

// CREAR USUARIOS
$("userForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("userMessage");
  const button = event.submitter;

  if (button) button.disabled = true;

  message.textContent = "Creando cuenta…";

  try {
    const data = await call("crearUsuario", {
      nombre: $("newName").value.trim(),
      correo: $("newEmail").value.trim(),
      rol: $("newRole").value,
      contrasena: $("newPassword").value
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudo crear la cuenta.");
    }

    message.textContent = "Cuenta creada correctamente.";

    event.target.reset();

  } catch (error) {
    message.textContent =
      error.message || "Ocurrió un error al crear la cuenta.";

  } finally {
    if (button) button.disabled = false;
  }
});

// COMUNICADOS MASIVOS
async function sendMass(prueba) {
  const msg = $("massMessage");

  const asunto = $("massAsunto").value.trim();
  const mensaje = $("massMensaje").value.trim();

  if (!asunto || !mensaje) {
    msg.textContent = "Escribe el asunto y el mensaje.";
    return;
  }

  if (
    !prueba &&
    !confirm(
      "¿Enviar este comunicado a todos los equipos del filtro seleccionado? No se puede deshacer."
    )
  ) {
    return;
  }

  $("massTest").disabled = true;
  $("massSend").disabled = true;

  msg.textContent = prueba
    ? "Enviando prueba…"
    : "Enviando comunicado…";

  try {
    const data = await call("enviarMasivo", {
      asunto,
      mensaje,
      filtroArea: $("massArea").value,
      filtroEstado: $("massEstado").value,
      prueba
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudo enviar el comunicado.");
    }

    msg.textContent = prueba
      ? "Prueba enviada a tu correo."
      : `Comunicado enviado a ${data.enviados || 0} equipo(s)` +
        (data.fallidos
          ? ` · ${data.fallidos} fallido(s).`
          : ".");

  } catch (error) {
    msg.textContent =
      error.message || "Ocurrió un error al enviar.";

  } finally {
    $("massTest").disabled = false;
    $("massSend").disabled = false;
  }
}

$("massForm").addEventListener("submit", event => {
  event.preventDefault();
  sendMass(false);
});

$("massTest").addEventListener("click", () => {
  sendMass(true);
});

// SEGURIDAD HTML
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// VALIDACIÓN DE ENLACES
function safeUrl(value) {
  try {
    const url = new URL(
      String(value),
      window.location.href
    );

    return ["http:", "https:"].includes(url.protocol)
      ? esc(url.href)
      : "#";

  } catch {
    return "#";
  }
}

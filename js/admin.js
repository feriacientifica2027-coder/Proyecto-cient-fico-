let token = "";
let role = "";
let selected = null;

const $ = id => document.getElementById(id);

async function call(accion, extra = {}) {
  if (!window.FERIA_API_URL) {
    throw new Error("Configura la URL de Apps Script en js/config.js.");
  }

  const response = await fetch(window.FERIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ accion, token, ...extra })
  });

  if (!response.ok) {
    throw new Error(`Error de conexión (${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida.");
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

    const isAdmin = ["administrador", "admin"].includes(role);

    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("sessionLabel").textContent =
      `Sesión: ${data.nombre || $("loginEmail").value.trim()} · Rol: ${data.rol || "usuario"}`;

    $("usersPanel").classList.toggle("hidden", !isAdmin);
    $("massPanel").classList.toggle("hidden", !isAdmin);
    $("siteEditorPanel").classList.toggle("hidden", !isAdmin);

    await refresh();

    if (isAdmin) {
      await loadSiteContent();
    }

  } catch (error) {
    message.textContent = error.message || "Error al iniciar sesión.";
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

    const rows = Array.isArray(data.proyectos) ? data.proyectos : [];

    const stats = [
      ["Total", rows.length],
      ["Recibidos", rows.filter(x => x.estado === "Recibido").length],
      ["Seleccionados", rows.filter(x => x.estado === "Seleccionado").length],
      ["No seleccionados", rows.filter(x => x.estado === "No seleccionado").length]
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
            <button type="button" class="table-link"
              data-code="${esc(project.codigo)}">Abrir</button>
          </td>
        </tr>
      `).join("")
      : '<tr><td colspan="6">Todavía no hay proyectos registrados.</td></tr>';

    document.querySelectorAll("[data-code]").forEach(button => {
      button.addEventListener("click", () => {
        const project = rows.find(
          item => String(item.codigo) === button.dataset.code
        );
        if (project) showDetail(project);
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
        <div><b>${esc(label)}</b>${esc(value)}</div>
      `).join("")}

      <div>
        <b>Archivo</b>
        ${
          project.archivoUrl
            ? `<a target="_blank" rel="noopener noreferrer"
                 href="${safeUrl(project.archivoUrl)}">Abrir anteproyecto</a>`
            : "No disponible"
        }
      </div>

      <div><b>Resumen</b>${esc(project.resumen)}</div>
    </div>

    <div class="admin-actions">
      <label>Estado
        <select id="newStatus">
          <option>Recibido</option>
          <option>En revisión</option>
          <option>Seleccionado</option>
          <option>No Seleccionado</option>
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
    message.textContent = error.message || "Error al guardar.";
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
    message.textContent = error.message || "Error al crear la cuenta.";
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

  if (!prueba && !confirm(
    "¿Enviar este comunicado a los equipos del filtro seleccionado? No se puede deshacer."
  )) return;

  $("massTest").disabled = true;
  $("massSend").disabled = true;
  msg.textContent = prueba ? "Enviando prueba…" : "Enviando comunicado…";

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
        (data.fallidos ? ` · ${data.fallidos} fallido(s).` : ".");

  } catch (error) {
    msg.textContent = error.message || "Error al enviar.";
  } finally {
    $("massTest").disabled = false;
    $("massSend").disabled = false;
  }
}

$("massForm").addEventListener("submit", event => {
  event.preventDefault();
  sendMass(false);
});

$("massTest").addEventListener("click", () => sendMass(true));

// EDITOR VISUAL DEL SITIO
function updateSitePreview() {
  const val = id => $(id).value;

  $("previewTitulo").textContent = val("siteTitulo") || "Feria Científica 2027";
  $("previewInstitucion").textContent = val("siteInstitucion");
  $("previewSubtitulo").textContent = val("siteSubtitulo");
  $("previewDescripcion").textContent = val("siteDescripcion");
  $("previewAviso").textContent = val("siteAviso");

  $("sitePreview").style.setProperty(
    "--preview-primary", val("siteColor1") || "#17365d"
  );
  $("sitePreview").style.setProperty(
    "--preview-secondary", val("siteColor2") || "#b32632"
  );
}

async function loadSiteContent() {
  const msg = $("siteEditorMessage");
  msg.textContent = "Cargando contenido…";

  try {
    const data = await call("obtenerContenido");

    if (!data.ok) {
      throw new Error(data.error || "No se pudo cargar el contenido.");
    }

    const c = data.contenido || {};

    const fields = {
      titulo: "siteTitulo",
      institucion: "siteInstitucion",
      subtitulo: "siteSubtitulo",
      descripcion: "siteDescripcion",
      fechaCierre: "siteFecha",
      correoContacto: "siteCorreo",
      colorPrimario: "siteColor1",
      colorSecundario: "siteColor2",
      aviso: "siteAviso",
      logoUrl: "siteLogo",
      imagenPortada: "siteCover"
    };

    Object.entries(fields).forEach(([key, id]) => {
      $(id).value = c[key] || "";
    });

    updateSitePreview();
    msg.textContent = "Contenido cargado.";

  } catch (error) {
    msg.textContent = error.message || "Error al cargar contenido.";
  }
}

if ($("siteEditorForm")) {
  [
    "siteTitulo",
    "siteInstitucion",
    "siteSubtitulo",
    "siteDescripcion",
    "siteAviso",
    "siteColor1",
    "siteColor2"
  ].forEach(id => {
    $(id).addEventListener("input", updateSitePreview);
  });

  $("siteEditorForm").addEventListener("submit", async event => {
    event.preventDefault();

    const btn = $("saveSiteContentBtn");
    const msg = $("siteEditorMessage");

    btn.disabled = true;
    msg.textContent = "Guardando cambios…";

    const contenido = {
      titulo: $("siteTitulo").value.trim(),
      institucion: $("siteInstitucion").value.trim(),
      subtitulo: $("siteSubtitulo").value.trim(),
      descripcion: $("siteDescripcion").value.trim(),
      fechaCierre: $("siteFecha").value,
      correoContacto: $("siteCorreo").value.trim(),
      colorPrimario: $("siteColor1").value,
      colorSecundario: $("siteColor2").value,
      aviso: $("siteAviso").value.trim(),
      logoUrl: $("siteLogo").value.trim(),
      imagenPortada: $("siteCover").value.trim()
    };

    try {
      const data = await call("guardarContenido", { contenido });

      if (!data.ok) {
        throw new Error(data.error || "No se pudieron guardar los cambios.");
      }

      msg.textContent =
        "Cambios guardados. Se mostrarán al recargar la página pública.";

      updateSitePreview();

    } catch (error) {
      msg.textContent = error.message || "Error al guardar.";
    } finally {
      btn.disabled = false;
    }
  });

  $("reloadContentBtn").addEventListener("click", loadSiteContent);
}

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
    const url = new URL(String(value), window.location.href);

    return ["http:", "https:"].includes(url.protocol)
      ? esc(url.href)
      : "#";

  } catch {
    return "#";
  }
    }

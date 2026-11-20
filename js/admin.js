"use strict";

/*
 * PANEL ADMINISTRATIVO — FERIA CIENTÍFICA 2027
 * La autorización real siempre corresponde al backend.
 * No se guarda el token en localStorage ni sessionStorage.
 */

let token = "";
let role = "";
let edition = "2027";
let currentUser = "";
let currentView = "overview";

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const fmt = value => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("es-PA");
};

function message(id, text, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("error", Boolean(isError));
}

function setButtonBusy(button, busy, busyText, normalText) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyText : normalText;
}

async function call(accion, extra = {}) {
  const endpoint = window.FERIA_API_URL || window.FERIA_CONFIG?.API_URL;

  if (!endpoint) {
    throw new Error("No se encontró la URL de Apps Script en js/config.js.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      accion,
      edicion: edition,
      ...extra,
      token
    })
  });

  if (!response.ok) {
    throw new Error(`Error de conexión (${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error("El servidor devolvió una respuesta que no es JSON.");
  }

  return data;
}

function showOnly(panelId) {
  ["loginPanel", "passwordChangePanel", "dashboard"].forEach(id => {
    $(id)?.classList.toggle("hidden", id !== panelId);
  });
}

function showLogout(show) {
  $("logoutBtn")?.classList.toggle("hidden", !show);
}

function normalizedRole(value) {
  return String(value || "").trim().toLowerCase();
}

/* INICIO DE SESIÓN */

$("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginForm").querySelector('[type="submit"]');
  const identifier = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  message("loginMessage", "Verificando credenciales…");
  setButtonBusy(button, true, "Verificando…", "Iniciar sesión");

  try {
    const data = await call("login", {
      usuario: identifier,
      correo: identifier,
      contrasena: password
    });

    if (!data.ok) {
      throw new Error(data.error || "No fue posible iniciar sesión.");
    }

    if (!data.token) {
      throw new Error("El servidor no devolvió una sesión válida.");
    }

    token = data.token;
    role = normalizedRole(data.rol);
    currentUser = data.usuario || identifier;

    if (data.debeCambiarClave === true || String(data.debeCambiarClave).toLowerCase() === "true") {
      $("newUsername").value = data.usuario || identifier;
      $("currentPassword").value = "";
      $("newPassword").value = "";
      $("confirmNewPassword").value = "";
      message("passwordChangeMessage", "");
      showOnly("passwordChangePanel");
      showLogout(true);
      $("sessionLabel").textContent = "Cambio de credenciales obligatorio";
      $("currentPassword").focus();
      return;
    }

    await enterDashboard(data);

  } catch (error) {
    token = "";
    role = "";
    message("loginMessage", error.message || "Error de autenticación.", true);
  } finally {
    setButtonBusy(button, false, "Verificando…", "Iniciar sesión");
  }
});

/* CAMBIO OBLIGATORIO DE CREDENCIALES */

$("passwordChangeForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("changePasswordBtn");
  const currentPassword = $("currentPassword").value;
  const newUsername = $("newUsername").value.trim();
  const newPassword = $("newPassword").value;
  const confirmation = $("confirmNewPassword").value;

  message("passwordChangeMessage", "");

  if (newUsername.length < 3) {
    message("passwordChangeMessage", "El nombre de usuario debe tener al menos 3 caracteres.", true);
    return;
  }

  if (newPassword.length < 12) {
    message("passwordChangeMessage", "La nueva contraseña debe tener al menos 12 caracteres.", true);
    return;
  }

  if (newPassword !== confirmation) {
    message("passwordChangeMessage", "Las contraseñas nuevas no coinciden.", true);
    return;
  }

  if (newPassword === currentPassword) {
    message("passwordChangeMessage", "La nueva contraseña debe ser diferente de la temporal.", true);
    return;
  }

  setButtonBusy(button, true, "Guardando…", "Guardar nuevas credenciales");

  try {
    const data = await call("cambiarCredenciales", {
      contrasenaActual: currentPassword,
      nuevoUsuario: newUsername,
      nuevaContrasena: newPassword
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudieron actualizar las credenciales.");
    }

    if (!data.token) {
      throw new Error("Las credenciales se actualizaron, pero el servidor no devolvió una nueva sesión. Inicia sesión nuevamente.");
    }

    token = data.token;
    currentUser = data.usuario || newUsername;
    role = normalizedRole(data.rol || role);

    message("passwordChangeMessage", "Credenciales actualizadas. Abriendo el panel…");
    await enterDashboard({
      ...data,
      nombre: data.nombre || currentUser,
      rol: data.rol || role
    });

  } catch (error) {
    message("passwordChangeMessage", error.message || "No se pudo completar el cambio.", true);
  } finally {
    setButtonBusy(button, false, "Guardando…", "Guardar nuevas credenciales");
  }
});

/* ENTRADA AL PANEL */

async function enterDashboard(userData = {}) {
  if (!["administrador", "evaluador", "consulta"].includes(role)) {
    throw new Error("La cuenta no tiene un rol reconocido.");
  }

  showOnly("dashboard");
  showLogout(true);

  const displayName = userData.nombre || currentUser || "Usuario";
  $("sessionLabel").textContent = `${displayName} · ${role}`;

  document.querySelectorAll(".admin-only").forEach(element => {
    element.classList.toggle("hidden", role !== "administrador");
  });

  await loadEditions();
  await showView("overview");
}

/* CERRAR SESIÓN */

$("logoutBtn")?.addEventListener("click", async () => {
  try {
    if (token) await call("logout");
  } catch (_) {
    // La sesión local se cierra aunque el servidor no responda.
  }

  token = "";
  role = "";
  currentUser = "";
  edition = "2027";

  $("loginPassword").value = "";
  $("currentPassword").value = "";
  $("newPassword").value = "";
  $("confirmNewPassword").value = "";

  showOnly("loginPanel");
  showLogout(false);
  $("sessionLabel").textContent = "Acceso restringido";
  message("loginMessage", "Sesión cerrada.");
});

/* EDICIONES */

async function loadEditions() {
  const select = $("editionSelect");
  if (!select) return;

  try {
    const data = await call("edicionesListar");

    if (!data.ok) {
      throw new Error(data.error || "No se pudieron cargar las ediciones.");
    }

    const editions = data.ediciones || [];

    select.innerHTML = editions.map(item => {
      const year = item.Anio || item.anio || item.Edicion || item.edicion;
      const name = item.Nombre || item.nombre || year;
      return `<option value="${esc(year)}">${esc(name)}</option>`;
    }).join("");

    if (!editions.length) {
      select.innerHTML = '<option value="2027">Feria Científica 2027</option>';
    }

    const preferred = editions.find(item =>
      String(item.Anio || item.anio || item.Edicion || item.edicion) === "2027"
    );

    edition = preferred
      ? "2027"
      : (select.value || "2027");

    select.value = edition;
  } catch (error) {
    select.innerHTML = '<option value="2027">Feria Científica 2027</option>';
    edition = "2027";
    if (role === "administrador") {
      console.warn("No se pudieron listar las ediciones:", error);
    }
  }
}

$("editionSelect")?.addEventListener("change", async event => {
  edition = event.target.value || "2027";
  await loadCurrentView();
});

/* NAVEGACIÓN Y VISTAS */

const titles = {
  overview: ["Resumen general", "Indicadores de la edición seleccionada."],
  projects: ["Proyectos registrados", "Inscripciones y evaluación de anteproyectos."],
  editions: ["Administrar ediciones", "Convocatorias independientes por año."],
  calendar: ["Calendario", "Fechas y actividades institucionales."],
  documents: ["Expedientes y documentos", "Documentación y versiones por proyecto."],
  credentials: ["Acreditaciones QR", "Credenciales de participantes y equipo."],
  surveys: ["Encuestas", "Instrumentos y respuestas."],
  partners: ["Colaboradores", "Aportes no monetarios y compromisos."],
  communications: ["Comunicados institucionales", "Mensajes segmentados e historial de envíos."],
  users: ["Usuarios y permisos", "Cuentas administrativas y alcance por edición."],
  content: ["Contenido público", "Información de la convocatoria."]
};

const adminViews = [
  "editions", "calendar", "documents", "credentials",
  "surveys", "partners", "users", "content", "communications"
];

document.querySelectorAll(".nav-item[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

async function showView(name) {
  if (!titles[name]) return;

  if (role !== "administrador" && adminViews.includes(name)) {
    return;
  }

  currentView = name;

  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.add("hidden");
  });

  $("view-" + name)?.classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  $("viewTitle").textContent = titles[name][0];
  $("viewSubtitle").textContent = titles[name][1];

  await loadView(name);
}

async function loadCurrentView() {
  await loadView(currentView);
}

async function loadView(name) {
  try {
    if (name === "overview") await loadOverview();
    if (name === "projects") await loadProjects();
    if (name === "editions") await loadEditionsList();
    if (name === "communications") await loadCommunications();

    const modules = {
      calendar: ["calendario", "calendarList"],
      documents: ["documentos", "documentsList"],
      credentials: ["acreditaciones", "credentialsList"],
      surveys: ["encuestas", "surveysList"],
      partners: ["colaboradores", "partnersList"]
    };

    if (modules[name]) {
      await loadModule(modules[name][0], modules[name][1]);
    }
  } catch (error) {
    alert(error.message || "No se pudo cargar esta sección.");
  }
}

$("refreshBtn")?.addEventListener("click", loadCurrentView);

/* RESUMEN GENERAL */

async function loadOverview() {
  const data = await call("panelResumen");

  if (!data.ok) {
    throw new Error(data.error || "No se pudo cargar el resumen.");
  }

  const summary = data.resumen || {};
  const byArea = summary.porArea || {};
  const byGrade = summary.porGrado || {};
  const byStatus = summary.porEstado || {};

  const stats = [
    ["Proyectos", summary.total || 0],
    ["Áreas temáticas", Object.keys(byArea).length],
    ["Grados participantes", Object.keys(byGrade).length],
    ["Estados registrados", Object.keys(byStatus).length]
  ];

  $("overviewStats").innerHTML = stats.map(([label, value]) => `
    <article class="metric-card">
      <span>${esc(label)}</span>
      <b>${Number(value) || 0}</b>
    </article>
  `).join("");

  renderBars("areaStats", byArea);
  renderBars("gradeStats", byGrade);
}

function renderBars(containerId, valuesObject) {
  const container = $(containerId);
  if (!container) return;

  const values = Object.entries(valuesObject || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const max = Math.max(1, ...values.map(item => Number(item[1]) || 0));

  container.innerHTML = values.length
    ? values.map(([label, amount]) => {
        const number = Number(amount) || 0;
        const width = Math.max(0, Math.min(100, Math.round(number / max * 100)));
        return `
          <div class="bar-row">
            <div>
              <span>${esc(label || "Sin dato")}</span>
              <b>${number}</b>
            </div>
            <i><span style="width:${width}%"></span></i>
          </div>
        `;
      }).join("")
    : '<p class="muted">Sin registros para esta edición.</p>';
}

/* ANTEPROYECTOS */

async function loadProjects() {
  const data = await call("listar", {
    turno: $("projectTurnFilter")?.value || ""
  });

  if (!data.ok) {
    throw new Error(data.error || "No se pudieron cargar los proyectos.");
  }

  const projects = data.proyectos || [];
  const canEvaluate = role === "administrador" || role === "evaluador";

  $("projectsBody").innerHTML = projects.map(project => `
    <tr>
      <td><b>${esc(project.Codigo)}</b></td>
      <td>${esc(project.Area)}</td>
      <td>${esc(project.Titulo)}</td>
      <td>${esc(project.Lider)}</td>
      <td>${esc(project.Grado)} · ${esc(project.Salon)}</td>
      <td>${esc(project.Estado)}</td>
      <td>
        ${canEvaluate ? `
          <button
            type="button"
            class="btn btn-small"
            data-project-code="${esc(project.Codigo)}">
            Evaluar
          </button>
        ` : '<span class="muted">Solo consulta</span>'}
      </td>
    </tr>
  `).join("") || '<tr><td colspan="7">No hay proyectos registrados.</td></tr>';
}

$("projectTurnFilter")?.addEventListener("change", loadProjects);

/* DETALLE Y EVALUACIÓN INDIVIDUAL */

function projectModal() {
  let modal = $("projectEvaluationModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "projectEvaluationModal";
  modal.className = "admin-modal";
  modal.innerHTML = `
    <section class="admin-modal-card">
      <div class="admin-modal-heading">
        <h2>Evaluación del proyecto</h2>
        <button type="button" id="closeProjectModal" aria-label="Cerrar">×</button>
      </div>

      <div id="projectDetails" class="project-details"></div>

      <form id="projectEvaluationForm">
        <input type="hidden" id="evaluationCode">

        <label for="evaluationStatus">Estado del proyecto</label>
        <select id="evaluationStatus" required>
          <option value="Recibido">Recibido</option>
          <option value="Seleccionado">Seleccionado</option>
          <option value="No seleccionado">No seleccionado</option>
          <option value="Retirado">Retirado</option>
        </select>

        <label for="evaluationObservations">Observaciones del comité</label>
        <textarea
          id="evaluationObservations"
          rows="5"
          maxlength="3000"
          placeholder="Escribe las observaciones correspondientes…"></textarea>

        <label class="inline-check">
          <input type="checkbox" id="evaluationNotify" checked>
          Notificar el cambio al correo del participante
        </label>

        <p id="evaluationMessage" class="message" role="status"></p>

        <div class="modal-actions">
          <button type="button" class="button secondary" id="cancelProjectEvaluation">Cancelar</button>
          <button type="submit" class="button primary" id="saveProjectEvaluation">Guardar evaluación</button>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  $("closeProjectModal").addEventListener("click", closeProjectModal);
  $("cancelProjectEvaluation").addEventListener("click", closeProjectModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeProjectModal();
  });
  $("projectEvaluationForm").addEventListener("submit", saveProjectEvaluation);

  return modal;
}

function closeProjectModal() {
  $("projectEvaluationModal")?.classList.remove("open");
}

async function openProjectEvaluation(code) {
  try {
    const data = await call("listar", {
      turno: $("projectTurnFilter")?.value || ""
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudieron consultar los proyectos.");
    }

    const project = (data.proyectos || []).find(
      item => String(item.Codigo) === String(code)
    );

    if (!project) {
      throw new Error("No se encontró el proyecto seleccionado.");
    }

    projectModal();

    $("evaluationCode").value = project.Codigo || "";
    $("evaluationStatus").value = project.Estado || "Recibido";
    $("evaluationObservations").value = project.Observaciones || "";

    $("projectDetails").innerHTML = `
      <p><b>Código:</b> ${esc(project.Codigo)}</p>
      <p><b>Título:</b> ${esc(project.Titulo)}</p>
      <p><b>Área:</b> ${esc(project.Area)}</p>
      <p><b>Líder:</b> ${esc(project.Lider)}</p>
      <p><b>Grado y salón:</b> ${esc(project.Grado)} · ${esc(project.Salon)}</p>
      <p><b>Asesor:</b> ${esc(project.Asesor || "No disponible")}</p>
      <p><b>Correo:</b> ${esc(project.Correo || "No disponible")}</p>
      <p><b>Estado actual:</b> ${esc(project.Estado)}</p>
    `;

    message("evaluationMessage", "");
    $("projectEvaluationModal").classList.add("open");
  } catch (error) {
    alert(error.message);
  }
}

$("projectsBody")?.addEventListener("click", event => {
  const button = event.target.closest("[data-project-code]");
  if (button) openProjectEvaluation(button.dataset.projectCode);
});

async function saveProjectEvaluation(event) {
  event.preventDefault();

  const button = $("saveProjectEvaluation");
  setButtonBusy(button, true, "Guardando…", "Guardar evaluación");
  message("evaluationMessage", "");

  try {
    const data = await call("actualizar", {
      codigo: $("evaluationCode").value,
      estado: $("evaluationStatus").value,
      observaciones: $("evaluationObservations").value,
      notificar: $("evaluationNotify").checked
    });

    if (!data.ok) {
      throw new Error(data.error || "No se pudo guardar la evaluación.");
    }

    message(
      "evaluationMessage",
      data.notificado
        ? "Evaluación guardada y participante notificado."
        : "Evaluación guardada correctamente."
    );

    await loadProjects();
    window.setTimeout(closeProjectModal, 1000);
  } catch (error) {
    message("evaluationMessage", error.message, true);
  } finally {
    setButtonBusy(button, false, "Guardando…", "Guardar evaluación");
  }
}

/* ADMINISTRACIÓN DE EDICIONES */

async function loadEditionsList() {
  const data = await call("edicionesListar");
  if (!data.ok) throw new Error(data.error || "No se pudieron cargar las ediciones.");

  $("editionsList").innerHTML = (data.ediciones || []).map(item => `
    <article class="list-row">
      <b>${esc(item.Nombre || item.Anio)}</b>
      <span>
        ${esc(item.Estado || "Sin estado")} · Cierre:
        ${esc(item.FechaCierre || "No definido")}
      </span>
    </article>
  `).join("") || '<p class="muted">Todavía no hay ediciones registradas.</p>';
}

$("editionForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("editionForm").querySelector('[type="submit"]');
  setButtonBusy(button, true, "Guardando…", "Guardar edición");

  try {
    const data = await call("edicionGuardar", {
      anio: $("edYear").value,
      nombre: $("edName").value.trim(),
      estado: $("edStatus").value,
      fechaCierre: $("edClose").value,
      descripcion: $("edDescription").value.trim()
    });

    if (!data.ok) throw new Error(data.error || "No se pudo guardar la edición.");

    message("editionMessage", "Edición guardada correctamente.");
    $("editionForm").reset();
    await loadEditions();
    await loadEditionsList();
  } catch (error) {
    message("editionMessage", error.message, true);
  } finally {
    setButtonBusy(button, false, "Guardando…", "Guardar edición");
  }
});

/* CALENDARIO */

$("calendarForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("calendarForm").querySelector('[type="submit"]');
  setButtonBusy(button, true, "Guardando…", "Agregar actividad");

  try {
    const data = await call("moduloGuardar", {
      modulo: "calendario",
      datos: {
        Titulo: $("calTitle").value.trim(),
        Tipo: $("calType").value.trim(),
        FechaInicio: $("calStart").value,
        FechaFin: $("calEnd").value,
        Descripcion: $("calDescription").value.trim(),
        Visible: true
      }
    });

    if (!data.ok) throw new Error(data.error || "No se pudo guardar la actividad.");

    $("calendarForm").reset();
    await loadModule("calendario", "calendarList");
  } catch (error) {
    alert(error.message);
  } finally {
    setButtonBusy(button, false, "Guardando…", "Agregar actividad");
  }
});

/* USUARIOS Y PERMISOS */

$("userForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("userForm").querySelector('[type="submit"]');
  setButtonBusy(button, true, "Creando…", "Crear usuario");

  try {
    const data = await call("crearUsuario", {
      nombre: $("userName").value.trim(),
      correo: $("userEmail").value.trim(),
      rol: $("userRole").value,
      contrasena: $("userPass").value,
      edicionesAsignadas: $("userEditions").value.trim() || "*"
    });

    if (!data.ok) throw new Error(data.error || "No se pudo crear el usuario.");

    message("userMessage", "Usuario creado. Deberá cambiar su contraseña temporal al iniciar sesión.");
    $("userForm").reset();
  } catch (error) {
    message("userMessage", error.message, true);
  } finally {
    setButtonBusy(button, false, "Creando…", "Crear usuario");
  }
});

/* COMUNICADOS INSTITUCIONALES */

async function loadCommunications() {
  const data = await call("comunicadosListar");
  if (!data.ok) {
    throw new Error(data.error || "No se pudo cargar el historial de comunicados.");
  }

  const rows = data.comunicados || [];
  $("communicationsList").innerHTML = rows.length
    ? rows.map(item => `
        <article class="list-row">
          <b>${esc(item.Asunto || "Comunicado")}</b>
          <span>
            ${esc(item.Estado || "—")} ·
            ${esc(item.Enviados || 0)} enviados /
            ${esc(item.Fallidos || 0)} fallidos ·
            ${esc(fmt(item.Fecha))}
          </span>
        </article>
      `).join("")
    : '<p class="muted">Todavía no hay comunicados enviados.</p>';
}

$("communicationForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const form = $("communicationForm");
  const button = form.querySelector('[type="submit"]');
  const status = $("commMessageStatus");
  const file = $("commFile").files[0];

  message("commMessageStatus", "");
  setButtonBusy(button, true, "Enviando…", "Enviar comunicado");

  try {
    const payload = {
      asunto: $("commSubject").value.trim(),
      mensaje: $("commMessage").value.trim(),
      grupos: [$("commGroup").value]
    };

    if (file) {
      if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
        throw new Error("Adjunta un archivo PDF, DOC o DOCX.");
      }

      if (file.size > 8 * 1024 * 1024) {
        throw new Error("El adjunto supera el límite de 8 MB de este formulario.");
      }

      payload.adjuntoNombre = file.name;
      payload.adjuntoMime = file.type || "application/octet-stream";
      payload.adjuntoBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("No se pudo leer el adjunto."));
        reader.readAsDataURL(file);
      });
    }

    const data = await call("comunicadoEnviar", payload);
    if (!data.ok) {
      throw new Error(data.error || "No se pudo enviar el comunicado.");
    }

    status.textContent =
      `Proceso completado: ${Number(data.enviados) || 0} enviados y ${Number(data.fallidos) || 0} fallidos.`;

    form.reset();
    await loadCommunications();
  } catch (error) {
    message("commMessageStatus", error.message, true);
  } finally {
    setButtonBusy(button, false, "Enviando…", "Enviar comunicado");
  }
});

/* MÓDULOS DE CONSULTA */

async function loadModule(moduleName, containerId) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = '<p class="muted">Cargando información…</p>';

  const data = await call("moduloListar", { modulo: moduleName });
  if (!data.ok) {
    throw new Error(data.error || `No se pudo cargar ${moduleName}.`);
  }

  const items =
    data.items ||
    data.registros ||
    data.datos ||
    data[moduleName] ||
    [];

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = '<p class="muted">No hay registros disponibles.</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const entries = Object.entries(item || {})
      .filter(([key, value]) =>
        !["Id", "Edicion", "Token", "Hash", "Sal"].includes(key) &&
        value !== "" && value !== null && value !== undefined
      )
      .slice(0, 7);

    return `
      <article class="list-row">
        <b>${esc(entries[0]?.[1] || "Registro")}</b>
        <span>
          ${entries.slice(1).map(([key, value]) =>
            `${esc(key)}: ${esc(value)}`
          ).join(" · ")}
        </span>
      </article>
    `;
  }).join("");
}

/* ESTADO INICIAL */

(function initializeAdmin() {
  showOnly("loginPanel");
  showLogout(false);

  document.querySelectorAll(".admin-only").forEach(element => {
    element.classList.add("hidden");
  });

  $("sessionLabel").textContent = "Acceso restringido";
})();

let token = "";
let role = "";
let edition = "2027";

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const fmt = value =>
  value instanceof Date
    ? value.toLocaleDateString("es-PA")
    : (value ? new Date(value).toLocaleDateString("es-PA") : "—");

async function call(accion, extra = {}) {
  if (!window.FERIA_API_URL) {
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
      edicion: edition,
      ...extra
    })
  });

  if (!response.ok) {
    throw new Error(`Error de conexión (${response.status}).`);
  }

  const data = await response.json();
  return data;
}

function message(id, text, isError = false) {
  const el = $(id);

  if (el) {
    el.textContent = text;
    el.classList.toggle("error", isError);
  }
}

/* ==========================================
   INICIO DE SESIÓN
   ========================================== */

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  message("loginMessage", "Verificando…");

  try {
    const d = await call("login", {
      correo: $("loginEmail").value.trim(),
      contrasena: $("loginPassword").value
    });

    if (!d.ok) {
      throw new Error(d.error || "No fue posible iniciar sesión.");
    }

    token = d.token;
    role = d.rol;

    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");

    $("sessionLabel").textContent = `${d.nombre} · ${d.rol}`;

    document.querySelectorAll(".admin-only").forEach(x => {
      x.classList.toggle("hidden", role !== "administrador");
    });

    await loadEditions();
    await showView("overview");

  } catch (err) {
    message("loginMessage", err.message, true);
  }
});

/* ==========================================
   CERRAR SESIÓN
   ========================================== */

$("logoutBtn").addEventListener("click", async () => {
  try {
    await call("logout");
  } catch (_) {}

  token = "";
  role = "";

  $("dashboard").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
  $("logoutBtn").classList.add("hidden");
  $("loginPassword").value = "";
});

$("refreshBtn").addEventListener("click", () => loadCurrentView());

$("editionSelect").addEventListener("change", async e => {
  edition = e.target.value;
  await loadCurrentView();
});

document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

/* ==========================================
   EDICIONES
   ========================================== */

async function loadEditions() {
  const d = await call("edicionesListar");

  if (!d.ok) {
    throw new Error(d.error || "No se pudieron cargar las ediciones.");
  }

  const list = d.ediciones || [];

  $("editionSelect").innerHTML = list.map(x =>
    `<option value="${esc(x.Anio)}">${esc(x.Nombre || x.Anio)}</option>`
  ).join("");

  if (!list.length) {
    $("editionSelect").innerHTML =
      '<option value="2027">2027</option>';
  }

  edition = $("editionSelect").value || "2027";
}

/* ==========================================
   VISTAS DEL PANEL
   ========================================== */

const titles = {
  overview: [
    "Resumen general",
    "Indicadores de la edición seleccionada."
  ],
  projects: [
    "Proyectos registrados",
    "Inscripciones y evaluación."
  ],
  editions: [
    "Administrar ediciones",
    "Convocatorias independientes por año."
  ],
  gallery: [
    "Galería fotográfica",
    "Gestión privada de imágenes y autorizaciones."
  ],
  photoStats: [
    "Estadísticas de fotografías",
    "Visualizaciones y descargas por edición."
  ],
  inventory: [
    "Inventario de laboratorio",
    "Materiales y equipos exclusivamente de laboratorio."
  ],
  calendar: [
    "Calendario",
    "Fechas y actividades institucionales."
  ],
  requests: [
    "Solicitudes",
    "Trámites relacionados con los proyectos."
  ],
  documents: [
    "Expedientes y documentos",
    "Documentación y versiones por proyecto."
  ],
  credentials: [
    "Acreditaciones QR",
    "Credenciales de participantes y equipo."
  ],
  surveys: [
    "Encuestas",
    "Instrumentos y respuestas."
  ],
  partners: [
    "Colaboradores",
    "Aportes no monetarios y compromisos."
  ],
  users: [
    "Usuarios y permisos",
    "Cuentas administrativas y alcance por edición."
  ],
  content: [
    "Contenido público",
    "Información de la convocatoria."
  ]
};

async function showView(name) {
  if (
    role !== "administrador" &&
    [
      "editions",
      "gallery",
      "photoStats",
      "inventory",
      "calendar",
      "requests",
      "documents",
      "credentials",
      "surveys",
      "partners",
      "users",
      "content"
    ].includes(name)
  ) {
    return;
  }

  document.querySelectorAll(".view-panel").forEach(x => {
    x.classList.add("hidden");
  });

  $("view-" + name)?.classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-view]").forEach(x => {
    x.classList.toggle("active", x.dataset.view === name);
  });

  $("viewTitle").textContent = titles[name]?.[0] || "Panel";
  $("viewSubtitle").textContent = titles[name]?.[1] || "";

  await loadView(name);
}

async function loadCurrentView() {
  const active = document.querySelector(".nav-item.active");

  if (active) {
    await loadView(active.dataset.view);
  }
}

async function loadView(name) {
  try {
    if (name === "overview") await loadOverview();
    if (name === "projects") await loadProjects();
    if (name === "editions") await loadEditionsList();
    if (name === "gallery") await loadGallery();
    if (name === "photoStats") await loadPhotoStats();

    if (name === "inventory") {
      await loadModule("inventario_laboratorio", "inventoryList");
    }

    if (name === "calendar") {
      await loadModule("calendario", "calendarList");
    }

    if (name === "requests") {
      await loadModule("solicitudes", "requestsList");
    }

    if (name === "documents") {
      await loadModule("documentos", "documentsList");
    }

    if (name === "credentials") {
      await loadModule("acreditaciones", "credentialsList");
    }

    if (name === "surveys") {
      await loadModule("encuestas", "surveysList");
    }

    if (name === "partners") {
      await loadModule("colaboradores", "partnersList");
    }

  } catch (e) {
    alert(e.message || "No se pudo cargar esta sección.");
  }
}

/* ==========================================
   RESUMEN GENERAL
   ========================================== */

async function loadOverview() {
  const d = await call("panelResumen");

  if (!d.ok) {
    throw new Error(d.error);
  }

  const r = d.resumen;

  const stats = [
    ["Proyectos", r.total],
    ["Áreas temáticas", Object.keys(r.porArea).length],
    ["Grados participantes", Object.keys(r.porGrado).length],
    ["Estados registrados", Object.keys(r.porEstado).length]
  ];

  $("overviewStats").innerHTML = stats.map(([a, b]) =>
    `<article class="metric-card">
      <span>${esc(a)}</span>
      <b>${Number(b) || 0}</b>
    </article>`
  ).join("");

  renderBars("areaStats", r.porArea);
  renderBars("gradeStats", r.porGrado);
}

function renderBars(id, obj) {
  const vals = Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1]);

  const max = Math.max(1, ...vals.map(x => x[1]));

  $(id).innerHTML = vals.length
    ? vals.map(([k, v]) =>
      `<div class="bar-row">
        <div>
          <span>${esc(k || "Sin dato")}</span>
          <b>${v}</b>
        </div>
        <i>
          <span style="width:${Math.round(v / max * 100)}%"></span>
        </i>
      </div>`
    ).join("")
    : '<p class="muted">Sin registros para esta edición.</p>';
}

/* ==========================================
   PROYECTOS Y EVALUACIÓN
   ========================================== */

async function loadProjects() {
  const d = await call("listar");

  if (!d.ok) {
    throw new Error(d.error || "No se pudieron cargar los proyectos.");
  }

  const projects = d.proyectos || [];

  $("projectsBody").innerHTML = projects.map(x =>
    `<tr>
      <td><b>${esc(x.codigo)}</b></td>
      <td>${esc(x.area)}</td>
      <td>${esc(x.titulo)}</td>
      <td>${esc(x.lider)}</td>
      <td>${esc(x.grado)} · ${esc(x.salon)}</td>
      <td>${esc(x.estado)}</td>
      <td>
        <button
          type="button"
          class="btn btn-small"
          data-project-code="${esc(x.codigo)}">
          Evaluar
        </button>
      </td>
    </tr>`
  ).join("") ||
  '<tr><td colspan="7">No hay proyectos registrados.</td></tr>';
                 }
/* ==========================================
   DETALLE Y EVALUACIÓN INDIVIDUAL
   ========================================== */

function projectModal() {
  let modal = $("projectEvaluationModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "projectEvaluationModal";

  modal.style.cssText = `
    position:fixed;
    inset:0;
    z-index:9999;
    background:rgba(0,0,0,.65);
    display:none;
    align-items:center;
    justify-content:center;
    padding:16px;
    overflow-y:auto;
  `;

  modal.innerHTML = `
    <section style="
      background:white;
      width:100%;
      max-width:680px;
      max-height:90vh;
      overflow-y:auto;
      border-radius:14px;
      padding:24px;
      color:#243247;
    ">
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      ">
        <h2 style="margin:0">Evaluación del proyecto</h2>

        <button
          type="button"
          id="closeProjectModal"
          aria-label="Cerrar"
          style="font-size:24px;border:0;background:none;cursor:pointer">
          ×
        </button>
      </div>

      <div id="projectDetails" style="margin-top:20px"></div>

      <form id="projectEvaluationForm">
        <input type="hidden" id="evaluationCode">

        <label for="evaluationStatus">Estado del proyecto</label>

        <select
          id="evaluationStatus"
          required
          style="width:100%;padding:11px;margin:8px 0 16px">
          <option value="Recibido">Recibido</option>
          <option value="En revisión">En revisión</option>
          <option value="Seleccionado">Seleccionado</option>
          <option value="No seleccionado">No seleccionado</option>
          <option value="Retirado">Retirado</option>
        </select>

        <label for="evaluationObservations">Observaciones del comité</label>

        <textarea
          id="evaluationObservations"
          rows="5"
          maxlength="3000"
          style="width:100%;padding:11px;margin:8px 0 16px"
          placeholder="Escribe las observaciones correspondientes..."></textarea>

        <label style="display:flex;align-items:center;gap:9px">
          <input type="checkbox" id="evaluationNotify" checked>
          Notificar el cambio al correo del participante
        </label>

        <p id="evaluationMessage" role="status"></p>

        <div style="
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:18px;
        ">
          <button type="button" id="cancelProjectEvaluation">
            Cancelar
          </button>

          <button type="submit" id="saveProjectEvaluation">
            Guardar evaluación
          </button>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  $("closeProjectModal").addEventListener("click", closeProjectModal);
  $("cancelProjectEvaluation").addEventListener("click", closeProjectModal);

  modal.addEventListener("click", e => {
    if (e.target === modal) closeProjectModal();
  });

  $("projectEvaluationForm").addEventListener("submit", saveProjectEvaluation);

  return modal;
}

function closeProjectModal() {
  const modal = $("projectEvaluationModal");
  if (modal) modal.style.display = "none";
}

async function openProjectEvaluation(code) {
  try {
    const d = await call("listar");

    if (!d.ok) {
      throw new Error(d.error || "No se pudieron consultar los proyectos.");
    }

    const project = (d.proyectos || []).find(
      x => String(x.codigo) === String(code)
    );

    if (!project) {
      throw new Error("No se encontró el proyecto seleccionado.");
    }

    projectModal();

    $("evaluationCode").value = project.codigo;
    $("evaluationStatus").value = project.estado || "Recibido";
    $("evaluationObservations").value = project.observaciones || "";

    $("projectDetails").innerHTML = `
      <div style="
        background:#f3f6fa;
        padding:16px;
        border-radius:10px;
        line-height:1.8;
      ">
        <p><b>Código:</b> ${esc(project.codigo)}</p>
        <p><b>Título:</b> ${esc(project.titulo)}</p>
        <p><b>Área:</b> ${esc(project.area)}</p>
        <p><b>Líder:</b> ${esc(project.lider)}</p>
        <p><b>Grado y salón:</b>
          ${esc(project.grado)} · ${esc(project.salon)}
        </p>
        <p><b>Asesor:</b> ${esc(project.asesor || "No disponible")}</p>
        <p><b>Correo:</b> ${esc(project.correo || "No disponible")}</p>
        <p><b>Tipo:</b> ${esc(project.tipo || "No especificado")}</p>
        <p><b>Estado actual:</b> ${esc(project.estado)}</p>
      </div>
    `;

    $("evaluationMessage").textContent = "";
    $("projectEvaluationModal").style.display = "flex";

  } catch (error) {
    alert(error.message);
  }
}

/* Abrir evaluación desde la tabla */

$("projectsBody").addEventListener("click", e => {
  const button = e.target.closest("[data-project-code]");

  if (!button) return;

  openProjectEvaluation(button.dataset.projectCode);
});

/* Guardar evaluación */

async function saveProjectEvaluation(e) {
  e.preventDefault();

  const button = $("saveProjectEvaluation");
  const messageElement = $("evaluationMessage");

  button.disabled = true;
  button.textContent = "Guardando...";
  messageElement.textContent = "";

  try {
    const d = await call("actualizar", {
      codigo: $("evaluationCode").value,
      estado: $("evaluationStatus").value,
      observaciones: $("evaluationObservations").value,
      notificar: $("evaluationNotify").checked
    });

    if (!d.ok) {
      throw new Error(d.error || "No se pudo guardar la evaluación.");
    }

    messageElement.textContent = d.notificado
      ? "Evaluación guardada y participante notificado."
      : "Evaluación guardada correctamente.";

    await loadProjects();

    setTimeout(closeProjectModal, 1200);

  } catch (error) {
    messageElement.textContent = error.message;
    messageElement.classList.add("error");

  } finally {
    button.disabled = false;
    button.textContent = "Guardar evaluación";
  }
}

/* ==========================================
   LISTA DE EDICIONES
   ========================================== */

async function loadEditionsList() {
  const d = await call("edicionesListar");

  if (!d.ok) {
    throw new Error(d.error);
  }

  $("editionsList").innerHTML = (d.ediciones || []).map(x =>
    `<article class="list-row">
      <b>${esc(x.Nombre)}</b>
      <span>
        ${esc(x.Estado)} · Cierre:
        ${esc(x.FechaCierre || "No definido")}
      </span>
    </article>`
  ).join("");
}

$("editionForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const d = await call("edicionGuardar", {
      anio: $("edYear").value,
      nombre: $("edName").value,
      estado: $("edStatus").value,
      fechaCierre: $("edClose").value,
      descripcion: $("edDescription").value
    });

    if (!d.ok) {
      throw new Error(d.error);
    }

    message("editionMessage", "Edición guardada.");

    await loadEditions();
    await loadEditionsList();

  } catch (x) {
    message("editionMessage", x.message, true);
  }
});

/* ==========================================
   GALERÍA FOTOGRÁFICA
   ========================================== */

async function loadGallery() {
  const d = await call("moduloListar", {
    modulo: "fotografias"
  });

  if (!d.ok) {
    throw new Error(d.error);
  }

  $("photoList").innerHTML = (d.registros || []).map(x =>
    `<article class="photo-card">
      ${x.Url ? `<img src="${esc(x.Url)}" alt="">` : ""}
      <div>
        <b>${esc(x.Titulo)}</b>
        <small>
          ${
            x.Publicada === true ||
            String(x.Publicada) === "true"
              ? "Publicada"
              : "No publicada"
          }
          · ${Number(x.Visualizaciones) || 0} vistas
        </small>
      </div>
    </article>`
  ).join("") ||
  '<p class="muted">No hay fotografías registradas.</p>';
}

$("photoForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const d = await call("moduloGuardar", {
      modulo: "fotografias",
      datos: {
        Titulo: $("photoTitle").value,
        Url: $("photoUrl").value,
        Descripcion: $("photoDescription").value,
        MiniaturaUrl: $("photoThumb").value,
        Autorizacion: $("photoConsent").checked ? "Sí" : "No",
        Publicada: $("photoPublish").checked,
        Visualizaciones: 0,
        Descargas: 0,
        Fecha: new Date().toISOString()
      }
    });

    if (!d.ok) {
      throw new Error(d.error);
    }

    message("photoMessage", "Fotografía registrada.");

    $("photoForm").reset();

    await loadGallery();

  } catch (x) {
    message("photoMessage", x.message, true);
  }
});

/* ==========================================
   ESTADÍSTICAS FOTOGRÁFICAS
   ========================================== */

async function loadPhotoStats() {
  const d = await call("fotografiaEstadisticas");

  if (!d.ok) {
    throw new Error(d.error);
  }

  const r = d.resumen;

  $("photoMetricCards").innerHTML = [
    ["Fotografías", r.fotografias],
    ["Publicadas", r.publicadas],
    ["Visualizaciones", r.visualizaciones],
    ["Descargas", r.descargas]
  ].map(([a, b]) =>
    `<article class="metric-card">
      <span>${a}</span>
      <b>${Number(b) || 0}</b>
    </article>`
  ).join("");

  $("photoRanking").innerHTML = (d.porFotografia || []).map(x =>
    `<tr>
      <td>${esc(x.titulo)}</td>
      <td>${x.visualizaciones}</td>
      <td>${x.descargas}</td>
    </tr>`
  ).join("") ||
  '<tr><td colspan="3">Todavía no hay visualizaciones.</td></tr>';

  renderBars(
    "photoDaily",
    Object.fromEntries(
      (d.porDia || []).map(x => [x.fecha, x.visualizaciones])
    )
  );
}

/* ==========================================
   MÓDULOS GENERALES
   ========================================== */

async function loadModule(module, target) {
  const d = await call("moduloListar", {
    modulo: module
  });

  if (!d.ok) {
    throw new Error(d.error);
  }

  const rows = d.registros || [];

  $(target).innerHTML = rows.length
    ? rows.map(x => {
      const title =
        x.Nombre ||
        x.Titulo ||
        x.Persona ||
        x.Responsable ||
        x.Tipo ||
        x.DocumentoId ||
        "Registro";

      const sub =
        x.Estado ||
        x.FechaInicio ||
        x.Fecha ||
        x.Categoria ||
        "";

      return `<article class="list-row">
        <b>${esc(title)}</b>
        <span>${esc(sub)}</span>
      </article>`;
    }).join("")
    : '<p class="muted">No hay registros en este módulo.</p>';
}

/* ==========================================
   INVENTARIO DE LABORATORIO
   ========================================== */

$("inventoryForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const total = Number($("invTotal").value);
    const available = Number($("invAvailable").value);

    if (available > total) {
      throw new Error(
        "La cantidad disponible no puede superar la cantidad total."
      );
    }

    const d = await call("moduloGuardar", {
      modulo: "inventario_laboratorio",
      datos: {
        Nombre: $("invName").value,
        Categoria: $("invCategory").value,
        CantidadTotal: total,
        CantidadDisponible: available,
        Ubicacion: $("invLocation").value,
        Estado: $("invState").value,
        Descripcion: $("invDescription").value,
        Actualizado: new Date().toISOString()
      }
    });

    if (!d.ok) {
      throw new Error(d.error);
    }

    message(
      "inventoryMessage",
      "Material agregado al inventario."
    );

    $("inventoryForm").reset();

    await loadModule(
      "inventario_laboratorio",
      "inventoryList"
    );

  } catch (x) {
    message("inventoryMessage", x.message, true);
  }
});

/* ==========================================
   CALENDARIO
   ========================================== */

$("calendarForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const d = await call("moduloGuardar", {
      modulo: "calendario",
      datos: {
        Titulo: $("calTitle").value,
        Tipo: $("calType").value,
        FechaInicio: $("calStart").value,
        FechaFin: $("calEnd").value,
        Descripcion: $("calDescription").value,
        Visible: true
      }
    });

    if (!d.ok) {
      throw new Error(d.error);
    }

    $("calendarForm").reset();

    await loadModule("calendario", "calendarList");

  } catch (x) {
    alert(x.message);
  }
});

/* ==========================================
   USUARIOS Y PERMISOS
   ========================================== */

$("userForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const d = await call("crearUsuario", {
      nombre: $("userName").value,
      correo: $("userEmail").value,
      rol: $("userRole").value,
      contrasena: $("userPass").value,
      edicionesAsignadas: $("userEditions").value || "*"
    });

    if (!d.ok) {
      throw new Error(d.error);
    }

    message(
      "userMessage",
      "Usuario creado correctamente."
    );

    $("userForm").reset();

  } catch (x) {
    message("userMessage", x.message, true);
  }
});

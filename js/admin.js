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
   PROYECTOS
   ========================================== */

async function loadProjects() {
  const d = await call("listar");

  if (!d.ok) {
    throw new Error(d.error);
  }

  $("projectsBody").innerHTML = (d.proyectos || []).map(x =>
    `<tr>
      <td><b>${esc(x.codigo)}</b></td>
      <td>${esc(x.area)}</td>
      <td>${esc(x.titulo)}</td>
      <td>${esc(x.lider)}</td>
      <td>${esc(x.grado)} · ${esc(x.salon)}</td>
      <td>${esc(x.estado)}</td>
    </tr>`
  ).join("") ||
  '<tr><td colspan="6">No hay proyectos registrados.</td></tr>';
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

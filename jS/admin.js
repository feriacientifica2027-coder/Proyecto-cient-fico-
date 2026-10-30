
let token = "";
let role = "";
let selected = null;

const $ = id => document.getElementById(id);

async function call(accion, extra = {}) {
  if (
    !window.FERIA_API_URL ||
    window.FERIA_API_URL.includes("PEGA_AQUI")
  ) {
    throw new Error(
      "Configura la URL de Apps Script en js/config.js."
    );
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

  return response.json();
}

// Inicio de sesión
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  $("loginMessage").textContent = "Verificando…";

  try {
    const data = await call("login", {
      correo: $("loginEmail").value.trim(),
      contrasena: $("loginPassword").value
    });

    if (!data.ok) {
      throw new Error(data.error);
    }

    token = data.token;
    role = data.rol;

    $("loginPanel").classList.add("hidden");
    $("dashboard").classList.remove("hidden");

    $("sessionLabel").textContent =
      `Sesión: ${data.nombre} · Rol: ${role}`;

    $("usersPanel").classList.toggle(
      "hidden",
      role !== "administrador"
    );

    await refresh();

  } catch (error) {
    $("loginMessage").textContent = error.message;
  }
});

// Cerrar sesión
$("logoutBtn").onclick = () => {
  token = "";
  $("dashboard").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
  $("loginPassword").value = "";
};

// Actualizar tabla
$("refreshBtn").onclick = refresh;

async function refresh() {
  try {
    const data = await call("listar");

    if (!data.ok) {
      throw new Error(data.error);
    }

    const rows = data.proyectos || [];

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

    $("projectsBody").innerHTML = rows.map(project => `
      <tr>
        <td><b>${esc(project.codigo)}</b></td>
        <td>${esc(project.area)}</td>
        <td>${esc(project.titulo)}</td>
        <td>${esc(project.lider)}</td>
        <td><span class="status">${esc(project.estado)}</span></td>
        <td>
          <button class="table-link" data-code="${esc(project.codigo)}">
            Abrir
          </button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll("[data-code]").forEach(button => {
      button.onclick = () => {
        showDetail(
          rows.find(project => project.codigo === button.dataset.code)
        );
      };
    });

  } catch (error) {
    alert(error.message);
  }
}

// Mostrar información del proyecto
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
        ["Grado / salón", project.grado + " · " + project.salon],
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
            ? `<a target="_blank" rel="noopener" href="${esc(project.archivoUrl)}">Abrir anteproyecto</a>`
            : "No disponible"
        }
      </div>

      <div>
        <b>Resumen</b>
        ${esc(project.resumen)}
      </div>
    </div>

    <div class="admin-actions">
      <select id="newStatus">
        <option>Recibido</option>
        <option>En revisión</option>
        <option>Aprobado</option>
        <option>Rechazado</option>
      </select>

      <textarea id="obs" rows="2" placeholder="Observaciones para el equipo">${esc(project.observaciones || "")}</textarea>

      <button class="button primary" id="saveStatus">
        Guardar evaluación
      </button>
    </div>

    <div id="saveMessage" class="message"></div>
  `;

  $("newStatus").value = project.estado;

  $("saveStatus").onclick = saveStatus;
}

// Guardar evaluación
async function saveStatus() {
  try {
    const data = await call("actualizar", {
      codigo: selected.codigo,
      estado: $("newStatus").value,
      observaciones: $("obs").value
    });

    if (!data.ok) {
      throw new Error(data.error);
    }

    $("saveMessage").textContent = "Actualización guardada.";

    await refresh();

  } catch (error) {
    $("saveMessage").textContent = error.message;
  }
}

// Crear nuevas cuentas
$("userForm").addEventListener("submit", async event => {
  event.preventDefault();

  try {
    const data = await call("crearUsuario", {
      nombre: $("newName").value,
      correo: $("newEmail").value,
      rol: $("newRole").value,
      contrasena: $("newPassword").value
    });

    if (!data.ok) {
      throw new Error(data.error);
    }

    $("userMessage").textContent =
      "Cuenta creada correctamente.";

    event.target.reset();

  } catch (error) {
    $("userMessage").textContent = error.message;
  }
});

// Evitar insertar texto recibido como HTML
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

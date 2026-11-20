/**
 * FERIA CIENTÍFICA
 * Formulario de inscripción por etapas
 * Instituto Benigno Jiménez Garay
 */

(() => {
  "use strict";

  const AREAS = [
    ["Biología", "BIO", "Seres vivos y procesos biológicos."],
    ["Ciencias Ambientales", "CAM", "Ambiente, ecosistemas y sostenibilidad."],
    ["Ciencias de la Computación", "CCO", "Computación, programación y datos."],
    ["Ciencias Sociales y del Comportamiento", "CSC", "Sociedad y comportamiento humano."],
    ["Física y Matemática", "FMA", "Fenómenos físicos y modelos matemáticos."],
    ["Ingeniería y Tecnología", "INY", "Diseño, procesos y tecnología."],
    ["Química", "QUI", "Materia, composición y transformaciones."],
    ["Salud y Medicina", "SYM", "Salud, prevención e investigación médica."]
  ];

  const STEP_NAMES = [
    "Área temática",
    "Información del proyecto",
    "Líder del equipo",
    "Integrantes",
    "Docente asesor",
    "Anteproyecto y confirmación"
  ];

  const MAX_WORDS = 250;
  const MAX_FILE_SIZE = 8 * 1024 * 1024;

  const form = document.getElementById("registroForm");
  const areaContainer = document.getElementById("areas");
  const areaInput = document.getElementById("area");
  const panels = [...document.querySelectorAll(".wizard-panel")];
  const tabs = [...document.querySelectorAll(".wizard-tab")];
  const progressBars = [
    ...document.querySelectorAll("#wizardProgress span")
  ];

  const stepDescription = document.getElementById("stepDescription");
  const stepCounter = document.getElementById("stepCounter");
  const wordCount = document.getElementById("wordCount");
  const resumen = document.getElementById("resumen");
  const archivo = document.getElementById("archivo");
  const submitBtn = document.getElementById("submitBtn");
  const finalResult = document.getElementById("finalResult");

  let currentStep = 0;
  let submitting = false;

  if (!form) return;

  /* --------------------------------
     CREACIÓN DE LAS ÁREAS
  -------------------------------- */

  AREAS.forEach(([name, code, description]) => {
    const label = document.createElement("label");
    label.className = "area-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "areaRadio";
    radio.value = code;

    const textContainer = document.createElement("span");

    const title = document.createElement("strong");
    title.textContent = name;

    const detail = document.createElement("small");
    detail.textContent = description;

    textContainer.append(title, detail);
    label.append(radio, textContainer);
    areaContainer.appendChild(label);

    radio.addEventListener("change", () => {
      areaInput.value = code;
      clearMessage(0);
    });
  });

  /* --------------------------------
     UTILIDADES
  -------------------------------- */

  function countWords(value) {
    const text = String(value || "").trim();
    return text ? text.split(/\s+/).length : 0;
  }

  function showMessage(step, message, type = "error") {
    const box = document.getElementById(`message-${step}`);

    if (!box) return;

    box.textContent = message;
    box.className = `wizard-message ${type}`;
  }

  function clearMessage(step) {
    const box = document.getElementById(`message-${step}`);

    if (!box) return;

    box.textContent = "";
    box.className = "wizard-message";
  }

  function clearAllMessages() {
    panels.forEach((_, index) => clearMessage(index));
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function getFormData() {
    return Object.fromEntries(new FormData(form).entries());
  }

  /* --------------------------------
     NAVEGACIÓN ENTRE ETAPAS
  -------------------------------- */

  function updateWizard() {
    panels.forEach((panel, index) => {
      panel.classList.toggle("active", index === currentStep);
    });

    tabs.forEach((tab, index) => {
      tab.classList.toggle("active", index === currentStep);
      tab.classList.toggle("completed", index < currentStep);
    });

    progressBars.forEach((bar, index) => {
      bar.classList.toggle("done", index <= currentStep);
    });

    stepDescription.textContent = STEP_NAMES[currentStep];
    stepCounter.textContent = `Paso ${currentStep + 1} de ${panels.length}`;

    if (currentStep === 5) {
      renderReview();
    }

    window.scrollTo({
      top: document.querySelector(".wizard").offsetTop - 15,
      behavior: "smooth"
    });
  }

  function validateStep(step) {
    clearMessage(step);

    const panel = panels[step];

    if (step === 0) {
      if (!areaInput.value) {
        showMessage(step, "Selecciona un área temática para continuar.");
        return false;
      }

      return true;
    }

    if (step === 2) {
      const email = form.elements.correo.value.trim().toLowerCase();
      const confirmation = document
        .getElementById("correoConfirmacion")
        .value.trim()
        .toLowerCase();

      if (email !== confirmation) {
        showMessage(step, "Los correos electrónicos no coinciden.");
        document.getElementById("correoConfirmacion").focus();
        return false;
      }
    }

    if (step === 1 && countWords(resumen.value) > MAX_WORDS) {
      showMessage(
        step,
        `El resumen tiene ${countWords(resumen.value)} palabras. El máximo es ${MAX_WORDS}.`
      );
      resumen.focus();
      return false;
    }

    const fields = [
      ...panel.querySelectorAll("input, select, textarea")
    ].filter(field => {
      return field.type !== "radio" &&
        field.type !== "checkbox" &&
        field.type !== "file" &&
        field.type !== "hidden";
    });

    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }

    if (step === 5) {
      const selectedFile = archivo.files[0];

      if (!selectedFile) {
        showMessage(step, "Adjunta el documento del anteproyecto.");
        archivo.focus();
        return false;
      }

      if (!/\.(pdf|doc|docx)$/i.test(selectedFile.name)) {
        showMessage(step, "El archivo debe estar en formato PDF, DOC o DOCX.");
        archivo.focus();
        return false;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        showMessage(
          step,
          "El archivo supera el límite provisional de 8 MB."
        );
        archivo.focus();
        return false;
      }

      if (!document.getElementById("declaracion").checked) {
        showMessage(
          step,
          "Debes aceptar la declaración antes de enviar la inscripción."
        );
        return false;
      }
    }

    return true;
  }

  document.querySelectorAll("[data-next]").forEach(button => {
    button.addEventListener("click", () => {
      if (!validateStep(currentStep)) return;

      if (currentStep < panels.length - 1) {
        currentStep++;
        updateWizard();
      }
    });
  });

  document.querySelectorAll("[data-prev]").forEach(button => {
    button.addEventListener("click", () => {
      if (currentStep > 0) {
        currentStep--;
        updateWizard();
      }
    });
  });

  /* --------------------------------
     CONTADOR DEL RESUMEN
  -------------------------------- */

  resumen.addEventListener("input", () => {
    const total = countWords(resumen.value);
    wordCount.textContent = total;

    resumen.setCustomValidity(
      total > MAX_WORDS
        ? `El resumen no puede superar ${MAX_WORDS} palabras.`
        : ""
    );

    clearMessage(1);
  });

  /* --------------------------------
     INFORMACIÓN DEL ARCHIVO
  -------------------------------- */

  archivo.addEventListener("change", () => {
    const file = archivo.files[0];
    const info = document.getElementById("fileInfo");

    clearMessage(5);

    if (!file) {
      info.textContent = "Formatos permitidos: PDF, DOC y DOCX.";
      return;
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

    info.textContent = `${file.name} · ${sizeMB} MB`;
  });

  /* --------------------------------
     RESUMEN FINAL
  -------------------------------- */

  function addReviewRow(container, label, value) {
    const labelCell = document.createElement("div");
    const valueCell = document.createElement("div");

    labelCell.textContent = label;
    valueCell.textContent = value || "No especificado";

    container.append(labelCell, valueCell);
  }

  function renderReview() {
    const data = getFormData();
    const summary = document.getElementById("reviewSummary");

    summary.replaceChildren();

    const selectedArea = AREAS.find(area => area[1] === areaInput.value);
    const selectedFile = archivo.files[0];

    const rows = [
      ["Área temática", selectedArea ? selectedArea[0] : ""],
      ["Título", data.titulo],
      ["Tipo", data.tipo],
      ["Turno", data.turno === "TM" ? "Matutino" : "Vespertino"],
      ["Requiere laboratorio", data.laboratorio],
      ["Resumen", data.resumen],
      ["Líder", data.lider],
      ["Correo", data.correo],
      ["Grado", data.grado],
      ["Salón", data.salon],
      ["Integrantes", data.integrantes || "Trabajo individual"],
      ["Docente asesor", data.asesor],
      ["Anteproyecto", selectedFile ? selectedFile.name : "Sin adjuntar"]
    ];

    rows.forEach(([label, value]) => {
      addReviewRow(summary, label, value);
    });
  }

  /* --------------------------------
     CONEXIÓN CON APPS SCRIPT
  -------------------------------- */

  async function sendToServer(payload) {
    const endpoint = window.FERIA_API_URL ||
      window.FERIA_CONFIG?.API_URL;

    if (!endpoint) {
      throw new Error("No se encontró la dirección de conexión del sistema.");
    }

    let response;

    try {
      response = await fetch(endpoint, {
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
        "El servidor no pudo procesar la solicitud. Inténtalo nuevamente."
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

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string" || !result.includes(",")) {
          reject(new Error("No se pudo procesar el documento."));
          return;
        }

        resolve(result.split(",")[1]);
      };

      reader.onerror = () => {
        reject(new Error("No se pudo leer el archivo seleccionado."));
      };

      reader.onabort = () => {
        reject(new Error("La lectura del archivo fue cancelada."));
      };

      reader.readAsDataURL(file);
    });
  }

  /* --------------------------------
     ENVÍO DEFINITIVO
  -------------------------------- */

  function showFinalResult(code) {
    form.classList.add("hidden");
    document.querySelector(".wizard-heading").classList.add("hidden");

    finalResult.classList.remove("hidden");
    finalResult.innerHTML = `
      <div class="wizard-result">
        <p class="eyebrow">Inscripción recibida</p>
        <h2>¡Tu proyecto ha sido registrado!</h2>
        <p>
          La inscripción se completó correctamente.
          Guarda el siguiente código para consultar tu proyecto.
        </p>
        <div class="result-code">${escapeHTML(code || "Código no disponible")}</div>
        <p>
          Si el servicio de correo está habilitado,
          recibirás una confirmación en la dirección registrada.
        </p>
        <a class="button primary" href="consulta.html">
          Consultar proyecto
        </a>
        <a class="button secondary" href="index.html">
          Volver al inicio
        </a>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (submitting) return;

    currentStep = 5;

    if (!validateStep(5)) return;

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Preparando inscripción…";

    try {
      const data = getFormData();
      const selectedFile = archivo.files[0];

      const base64 = await readFileAsBase64(selectedFile);

      submitBtn.textContent = "Enviando inscripción…";

      const payload = {
        ...data,
        accion: "registrar",
        edicion: window.FERIA_CONFIG?.EDICION || 2027,
        archivoNombre: selectedFile.name,
        archivoMime: selectedFile.type || "application/octet-stream",
        archivoBase64: base64
      };

      delete payload.areaRadio;

      const result = await sendToServer(payload);

      if (!result || result.ok !== true) {
        throw new Error(
          result?.error || "No se pudo completar la inscripción."
        );
      }

      showFinalResult(result.codigo);

    } catch (error) {
      showMessage(
        5,
        error.message || "Ocurrió un error al enviar la inscripción."
      );

      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar inscripción";
    }
  });

  /* --------------------------------
     INICIO
  -------------------------------- */

  updateWizard();

})();

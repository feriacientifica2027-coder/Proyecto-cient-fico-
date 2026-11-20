document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("convocatoriaModal");
  const cerrar = document.getElementById("cerrarConvocatoria");
  const abrir = document.getElementById("abrirConvocatoria");

  if (!modal || !cerrar || !abrir) return;

  const CLAVE = "feria2027_convocatoria_vista";

  function mostrarConvocatoria() {
    modal.classList.add("activa");
    document.body.style.overflow = "hidden";
  }

  function cerrarConvocatoria() {
    modal.classList.remove("activa");
    document.body.style.overflow = "";

    try {
      localStorage.setItem(CLAVE, "si");
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de visualización.");
    }
  }

  let yaVista = false;

  try {
    yaVista = localStorage.getItem(CLAVE) === "si";
  } catch (error) {
    yaVista = false;
  }

  if (!yaVista) {
    mostrarConvocatoria();
  }

  cerrar.addEventListener("click", cerrarConvocatoria);
  abrir.addEventListener("click", mostrarConvocatoria);

  modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
      cerrarConvocatoria();
    }
  });

  document.addEventListener("keydown", function (evento) {
    if (
      evento.key === "Escape" &&
      modal.classList.contains("activa")
    ) {
      cerrarConvocatoria();
    }
  });
});

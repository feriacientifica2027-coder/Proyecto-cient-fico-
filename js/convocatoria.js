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

        // Recordar que este visitante ya cerró el cartel
        localStorage.setItem(CLAVE, "si");
    }

    // Mostrar automáticamente a visitantes nuevos
    if (localStorage.getItem(CLAVE) !== "si") {
        mostrarConvocatoria();
    }

    // Cerrar con la X
    cerrar.addEventListener("click", cerrarConvocatoria);

    // Abrir nuevamente con el botón
    abrir.addEventListener("click", mostrarConvocatoria);

    // Cerrar al pulsar fuera del cartel
    modal.addEventListener("click", function (evento) {
        if (evento.target === modal) {
            cerrarConvocatoria();
        }
    });

    // Cerrar con Escape
    document.addEventListener("keydown", function (evento) {
        if (evento.key === "Escape" && modal.classList.contains("activa")) {
            cerrarConvocatoria();
        }
    });
});

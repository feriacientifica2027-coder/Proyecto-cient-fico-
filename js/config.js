/** Configuración central de Feria Científica. */
window.FERIA_CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/AKfycbwll1MLFSAeCWyVY3JeZcn0PVD5_8duGLJvCMv7SUzJRYVSxNllgZXZjm8l0IqG71UQLg/exec",

  EDICION: 2027,

  ZONA_HORARIA: "America/Panama",

  COLORES: {
    principal: "#194D3B",
    secundario: "#34745A",
    arena: "#C6AD83",
    fondo: "#EDE8DA",
    blanco: "#FFFFFF"
  },

  TURNOS: {
    TM: "Matutino",
    TV: "Vespertino"
  }
});

window.FERIA_API_URL = window.FERIA_CONFIG.API_URL;

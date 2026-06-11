const socket = io();
let miApodo = "";
let escribiendoTimeout;

// 1. CONFIRMACIÓN DE SALIDA (Si intenta cerrar la pestaña o el navegador)
window.addEventListener('beforeunload', (e) => {
    // Nota: Los navegadores modernos muestran su propio mensaje genérico, 
    // pero activar esto asegura que se le pregunte al usuario antes de perder el chat.
    e.preventDefault();
    e.returnValue = '';
});

function obtenerDatos() {
    miApodo = document.getElementById('apodo').value.trim() || "Anónimo";
    return {
        apodo: miApodo,
        edad: document.getElementById('edad').value || "?",
        sexo: document.getElementById('sexo').value
    };
}

function crearSala() {
    socket.emit('crear_sala', obtenerDatos());
}

function unirseSala() {
    const codigo = document.getElementById('codigo-invitacion').value.toUpperCase().trim();
    if(!codigo) return alert("Por favor ingresa un código válido");
    socket.emit('unirse_sala', { codigo, datos: obtenerDatos() });
}

socket.on('sala_creada', (codigo) => {
    document.getElementById('pantalla-login').classList.add('oculto');
    document.getElementById('pantalla-chat').classList.remove('oculto');
    document.getElementById('header-titulo').innerText = `Código: ${codigo}`;
    document.getElementById('header-subtitulo').innerText = "Comparte el código para empezar";
});

socket.on('chat_iniciado', (usuarios) => {
    document.getElementById('pantalla-login').classList.add('oculto');
    document.getElementById('pantalla-chat').classList.remove('oculto');
    const compañero = usuarios.find(u => u.apodo !== miApodo) || usuarios;
    document.getElementById('header-titulo').innerText = compañero.apodo;
    document.getElementById('header-subtitulo').innerText = `${compañero.edad} años • ${compañero.sexo}`;
});

function enviarTexto() {
    const input = document.getElementById('texto-mensaje');
    const txt = input.value.trim();
    if(!txt) return;
    
    // Avisar al otro que ya dejamos de escribir al enviar el mensaje
    socket.emit('usuario_escribiendo', false);
    
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: txt, usuario: miApodo });
    renderizarMensaje('yo', miApodo, 'texto', txt);
    input.value = "";
}

// 3. ENVIAR AL PRESIONAR LA TECLA ENTER & DETECTAR QUE ESCRIBE
function detectarTeclas(event) {
    // Si presiona Enter, envía el mensaje
    if (event.key === 'Enter') {
        enviarTexto();
        return;
    }

    // Lógica para avisar "Escribiendo..."
    socket.emit('usuario_escribiendo', true);
    
    // Borrar el temporizador anterior para que no parpadee
    clearTimeout(escribiendoTimeout);
    
    // Si el usuario pasa 1.5 segundos sin presionar una tecla, asumimos que paró de escribir
    escribiendoTimeout = setTimeout(() => {
        socket.emit('usuario_escribiendo', false);
    }, 1500);
}

// 2. MOSTRAR CUANDO EL OTRO USUARIO ESTÁ ESCRIBIENDO
socket.on('otro_escribiendo', (estaEscribiendo) => {
    const indicador = document.getElementById('indicador-escribiendo');
    const nombreCompañero = document.getElementById('header-titulo').innerText;
    
    if (estaEscribiendo) {
        indicador.innerText = `${nombreCompañero} está escribiendo...`;
    } else {
        indicador.innerText = ""; // Limpiar el texto si dejó de escribir
    }
});

// Control de envío de archivos (Fotos y Videos)
document.getElementById('archivo').addEventListener('change', (e) => {
    const file = e.target.files;
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
        const tipo = file.type.startsWith('image') ? 'foto' : 'video';
        socket.emit('enviar_mensaje', { tipo: tipo, contenido: reader.result, usuario: miApodo });
        renderizarMensaje('yo', miApodo, tipo, reader.result);
    };
    reader.readAsDataURL(file);
});

socket.on('recibir_mensaje', (data) => {
    renderizarMensaje('otro', data.usuario, data.tipo, data.contenido);
});

// Botón de salir manual con confirmación segura
function salirManualmente() {
    if(confirm("¿Estás completamente seguro de que quieres salir? Todo el historial del chat se borrará de inmediato y de forma permanente.")) {
        window.location.reload(); 
    }
}

socket.on('chat_finalizado', () => {
    alert("El otro usuario abandonó el chat o cerró la pestaña. Historial destruido.");
    window.location.reload(); 
});

socket.on('error_ingreso', (msg) => alert(msg));

function renderizarMensaje(claseOrigen, usuario, tipo, contenido) {
    const contenedor = document.getElementById('caja-mensajes');
    
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${claseOrigen}`;
    
    const autor = document.createElement('div');
    autor.className = 'msg-autor';
    autor.innerText = usuario;
    wrapper.appendChild(autor);
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    if (tipo === 'texto') {
        bubble.innerText = contenido;
    } else {
        const media = document.createElement(tipo === 'foto' ? 'img' : 'video');
        media.src = contenido;
        if(tipo === 'video') media.controls = true;
        bubble.appendChild(media);
    }
    
    wrapper.appendChild(bubble);
    contenedor.appendChild(wrapper);
    
    contenedor.scrollTop = contenedor.scrollHeight;
}
// === SISTEMA DE MINIJUEGOS ===
let miFicha = ""; 
let turnoGato = "";
let tablero = Array(9).fill("");

const baseVerdades = [
    "¿Qué es lo más vergonzoso que has hecho por chat?",
    "¿Has mentido sobre tu edad o sexo alguna vez en internet?",
    "¿Cuál es tu mayor secreto que nadie en la vida real conoce?",
    "¿Qué fue lo primero que pensaste cuando iniciaste este chat?",
    "¿Cuál ha sido tu peor cita romántica o experiencia conociendo a alguien?"
];

const baseRetos = [
    "Envía una foto divertida o extraña usando el botón de archivos ahora mismo.",
    "Escribe los próximos 3 mensajes usando únicamente emojis.",
    "Confiésale un secreto muy exagerado e inventado al otro usuario.",
    "Escribe un poema improvisado de 4 líneas dedicado a este chat anónimo.",
    "Intenta escribir tu nombre al revés con los ojos cerrados y envíalo."
];

function alternarMenuJuegos() {
    document.getElementById('menu-juegos').classList.toggle('oculto');
}

function cerrarJuegos() {
    document.getElementById('menu-juegos').classList.add('oculto');
    document.getElementById('juego-verdad-reto').classList.add('oculto');
    document.getElementById('juego-gato').classList.add('oculto');
}

// LÓGICA: VERDAD O RETO
function iniciarVerdadOReto() {
    cerrarJuegos();
    document.getElementById('juego-verdad-reto').classList.remove('oculto');
    document.getElementById('vr-titulo').innerText = "Verdad o Reto";
    document.getElementById('vr-texto').innerText = "Elige una opción para enviar un desafío al chat.";
}

function obtenerDesafio(categoria) {
    const lista = categoria === 'verdad' ? baseVerdades : baseRetos;
    const aleatorio = lista[Math.floor(Math.random() * lista.length)];
    
    const textoFinal = `[🎲 ${categoria.toUpperCase()}] ${aleatorio}`;
    
    // Lo envía al chat como si fuera un mensaje del juego
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: textoFinal, usuario: `SISTEMA JUEGOS (${miApodo})` });
    renderizarMensaje('yo', 'JUEGO', 'texto', textoFinal);
    cerrarJuegos();
}

// LÓGICA: TRES EN LÍNEA (GATO)
function iniciarGato() {
    cerrarJuegos();
    miFicha = "X"; // El que abre el juego inicia con X
    turnoGato = "X";
    tablero = Array(9).fill("");
    limpiarInterfazGato();
    
    document.getElementById('juego-gato').classList.remove('oculto');
    document.getElementById('gato-turno').innerText = "Tu turno (X)";
    
    // Le avisa al otro usuario que abra su tablero
    socket.emit('accion_minijuego', { tipo: 'abrir_gato', tablero, turnoGato });
}

function marcarGato(posicion) {
    if (turnoGato !== miFicha || tablero[posicion] !== "") return;
    
    tablero[posicion] = miFicha;
    turnoGato = miFicha === "X" ? "O" : "X"; 
    
    actualizarTableroVisual();
    verificarGanadorGato();
    
    // Sincronizar jugada con el rival
    socket.emit('accion_minijuego', { tipo: 'jugada_gato', tablero, turnoGato });
}

function actualizarTableroVisual() {
    const celdas = document.querySelectorAll('.celda-gato');
    celdas.forEach((celda, i) => {
        celda.innerText = tablero[i];
    });
    
    const indicador = document.getElementById('gato-turno');
    if (turnoGato === miFicha) {
        indicador.innerText = `Tu turno (${miFicha})`;
    } else {
        indicador.innerText = "Turno del rival...";
    }
}

function limpiarInterfazGato() {
    document.querySelectorAll('.celda-gato').forEach(celda => celda.innerText = "");
}

function reiniciarGato() {
    iniciarGato();
}

function verificarGanadorGato() {
    const combinaciones = [, [3,4,5], [6,7,8], // Horizontales, [1,4,7], [2,5,8], // Verticales, [2,4,6]           // Diagonales
    ];
    
    for (let combo of combinaciones) {
        const [a, b, c] = combo;
        if (tablero[a] && tablero[a] === tablero[b] && tablero[a] === tablero[c]) {
            document.getElementById('gato-turno').innerText = `¡Ganador: ${tablero[a]}!`;
            turnoGato = "FIN";
            return;
        }
    }
    
    if (!tablero.includes("")) {
        document.getElementById('gato-turno').innerText = "¡Empate!";
        turnoGato = "FIN";
    }
}

// ESCUCHAR SEÑALES DE JUEGO DEL RIVAL
socket.on('recibir_minijuego', (data) => {
    if (data.tipo === 'abrir_gato') {
        miFicha = "O"; // Al invitado le toca ser O
        tablero = data.tablero;
        turnoGato = data.turnoGato;
        limpiarInterfazGato();
        document.getElementById('juego-gato').classList.remove('oculto');
        actualizarTableroVisual();
    }
    
    if (data.tipo === 'jugada_gato') {
        tablero = data.tablero;
        turnoGato = data.turnoGato;
        actualizarTableroVisual();
        verificarGanadorGato();
    }
});

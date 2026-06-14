const socket = io();
let miApodo = "";
let escribiendoTimeout;
let miEleccionPPT = "";
let eleccionRivalPPT = "";


// CONTROL DE ESTADO DEL JUEGO DEL GATO
let miFicha = ""; // "X" u "O"
let turnoGato = ""; // De quién es el turno actualmente
let tablero = Array(9).fill("");
let juegoActivo = false;
let tipoElegidoPorRival = ""; 

// 1. CONFIRMACIÓN DE SALIDA DE LA PÁGINA (Navegador)
window.addEventListener('beforeunload', (e) => {
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
    
    socket.emit('usuario_escribiendo', false);
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: txt, usuario: miApodo });
    renderizarMensaje('yo', miApodo, 'texto', txt);
    input.value = "";
}

function detectarTeclas(event) {
    if (event.key === 'Enter') {
        enviarTexto();
        return;
    }
    socket.emit('usuario_escribiendo', true);
    clearTimeout(escribiendoTimeout);
    escribiendoTimeout = setTimeout(() => {
        socket.emit('usuario_escribiendo', false);
    }, 1500);
}

socket.on('otro_escribiendo', (estaEscribiendo) => {
    const indicador = document.getElementById('indicador-escribiendo');
    const nombreCompañero = document.getElementById('header-titulo').innerText;
    indicador.innerText = estaEscribiendo ? `${nombreCompañero} está escribiendo...` : "";
});

// CONTROL DE MENÚ FLOTANTE Y PARPADEO NOTIFICACIÓN
function alternarMenuJuegos() {
    const menu = document.getElementById('menu-juegos');
    menu.classList.toggle('oculto');
    // Detener parpadeo si el usuario abre el menú manualmente
    document.querySelector('.btn-juegos').style.animation = "";
}

function notificarActividadJuego() {
    const menu = document.getElementById('menu-juegos');
    // Si el menú está cerrado, hace parpadear el botón del control 
    if (menu.classList.contains('oculto')) {
        const btn = document.querySelector('.btn-juegos');
        btn.style.animation = "parpadeoAlerta 0.8s infinite alternate";
        
        // Inyectamos dinámicamente la animación si no existe
        if (!document.getElementById('style-parpadeo')) {
            const style = document.createElement('style');
            style.id = 'style-parpadeo';
            style.innerHTML = `@keyframes parpadeoAlerta { from { background: #2a3942; } to { background: #00a884; } }`;
            document.head.appendChild(style);
        }
    }
}

function cerrarJuegos() {
    // Si hay un juego de Gato activo, preguntar antes de cerrar
    if (juegoActivo && !document.getElementById('juego-gato').classList.contains('oculto')) {
        if (!confirm("¿Estás seguro de que quieres salir del juego actual? Perderás tu progreso.")) {
            return; 
        }
        juegoActivo = false;
        socket.emit('accion_minijuego', { tipo: 'abandono_gato', usuario: miApodo });
    }
    
    document.getElementById('menu-juegos').classList.add('oculto');
    document.getElementById('juego-verdad-reto').classList.add('oculto');
    document.getElementById('juego-gato').classList.add('oculto');
    document.getElementById('juego-dados').classList.add('oculto');
    document.getElementById('juego-ppt').classList.add('oculto');
    
    const textoEspera = document.getElementById('vr-espera-texto');
    if (textoEspera) textoEspera.remove();
}

// LÓGICA: VERDAD O RETO
function iniciarVerdadOReto() {
    alternarMenuJuegos();
    document.getElementById('juego-verdad-reto').classList.remove('oculto');
    document.getElementById('vr-pantalla-seleccion').classList.remove('oculto');
    document.getElementById('vr-pantalla-redaccion').classList.add('oculto');
    document.getElementById('vr-titulo').innerText = "Verdad o Reto";
}

function enviarPeticionVR(categoria) {
    document.getElementById('vr-pantalla-seleccion').classList.add('oculto');
    document.getElementById('vr-titulo').innerText = "Esperando...";
    
    const p = document.createElement('p');
    p.id = "vr-espera-texto";
    p.style.fontSize = "14px";
    p.style.color = "#8696a0";
    p.innerText = `Le has pedido un ${categoria.toUpperCase()} a tu compañero. Esperando redacción...`;
    document.getElementById('juego-verdad-reto').appendChild(p);

    socket.emit('accion_minijuego', { tipo: 'peticion_vr', categoria: categoria, solicitante: miApodo });
}

function enviarDesafioCreado() {
    const input = document.getElementById('vr-input-desafio');
    const textoDesafio = input.value.trim();
    if (!textoDesafio) return alert("¡Debes escribir una pregunta o un reto!");

    const mensajeFinal = `[🎲 ${tipoElegidoPorRival.toUpperCase()} PERSONALIZADO] ${textoDesafio}`;
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: mensajeFinal, usuario: `DESAFÍO DE ${miApodo}` });
    renderizarMensaje('yo', 'JUEGO', 'texto', mensajeFinal);
    
    input.value = "";
    document.getElementById('juego-verdad-reto').classList.add('oculto');
}

// LÓGICA: DADOS VIRTUALES
function iniciarDados() {
    alternarMenuJuegos();
    document.getElementById('juego-dados').classList.remove('oculto');
    document.getElementById('dado-resultado').innerText = "🎲";
    document.getElementById('dados-texto').innerText = "Lanza el dado para competir con tu compañero.";
}

function lanzarDado() {
    const numero = Math.floor(Math.random() * 6) + 1;
    const carasDados = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    
    document.getElementById('dado-resultado').innerText = carasDados[numero];
    document.getElementById('dados-texto').innerText = `¡Sacaste un ${numero}!`;
    
    const mensajeDado = `[🎲 DADOS] Saqué un número ${numero} en el dado virtual.`;
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: mensajeDado, usuario: miApodo });
    renderizarMensaje('yo', miApodo, 'texto', mensajeDado);
}

// LÓGICA: PIEDRA, PAPEL O TIJERA
function iniciarPPT() {
    alternarMenuJuegos();
    miEleccionPPT = "";
    eleccionRivalPPT = "";
    
    document.getElementById('juego-ppt').classList.remove('oculto');
    document.getElementById('ppt-estado').innerText = "Elige tu jugada en secreto...";
    document.getElementById('ppt-resultado').innerText = "";
    
    // Habilitar y resetear estilos de botones
    const opciones = ['piedra', 'papel', 'tijera'];
    opciones.forEach(op => {
        const btn = document.getElementById(`btn-ppt-${op}`);
        btn.disabled = false;
        btn.style.background = "#2a3942";
    });

    // Le avisa al oponente que abra su ventana de juego
    socket.emit('accion_minijuego', { tipo: 'abrir_ppt' });
}

function elegirPPT(opcion) {
    miEleccionPPT = opcion;
    document.getElementById('ppt-estado').innerText = "¡Elección registrada! Esperando al rival...";
    
    // Deshabilitar botones y destacar el elegido
    const opciones = ['piedra', 'papel', 'tijera'];
    opciones.forEach(op => {
        const btn = document.getElementById(`btn-ppt-${op}`);
        btn.disabled = true;
        if(op === opcion) {
            btn.style.background = "#00a884";
        }
    });

    // Enviar jugada al rival
    socket.emit('accion_minijuego', { tipo: 'jugada_ppt', eleccion: opcion, usuario: miApodo });
    
    // Si el rival ya había elegido, procesamos de una vez
    if (eleccionRivalPPT) {
        calcularResultadoPPT();
    }
}

function calcularResultadoPPT() {
    const iconos = { piedra: "✊", papel: "✋", tijera: "✌️" };
    let textoResultado = "";

    if (miEleccionPPT === eleccionRivalPPT) {
        textoResultado = `¡Empate! Ambos eligieron ${iconos[miEleccionPPT]}`;
    } else if (
        (miEleccionPPT === "piedra" && eleccionRivalPPT === "tijera") ||
        (miEleccionPPT === "papel" && eleccionRivalPPT === "piedra") ||
        (miEleccionPPT === "tijera" && eleccionRivalPPT === "papel")
    ) {
        textoResultado = `¡Ganaste la ronda! 🎉<br>Tu ${iconos[miEleccionPPT]} vence a ${iconos[eleccionRivalPPT]}`;
    } else {
        textoResultado = `Perdiste esta ronda 😢<br>El rival te venció con ${iconos[eleccionRivalPPT]}`;
    }

    document.getElementById('ppt-estado').innerText = "¡Partida terminada!";
    document.getElementById('ppt-resultado').innerHTML = textoResultado;
}


// LÓGICA REESCRITA: TRES EN LÍNEA (GATO)
function iniciarGato() {
    alternarMenuJuegos();
    miFicha = "X"; 
    turnoGato = "X";
    tablero = Array(9).fill("");
    juegoActivo = true;
    
    limpiarInterfazGato();
    document.getElementById('juego-gato').classList.remove('oculto');
    document.getElementById('gato-turno').innerText = "Tu turno (X)";
    
    socket.emit('accion_minijuego', { tipo: 'abrir_gato', tablero, turnoGato });
}

function marcarGato(posicion) {
    if (!juegoActivo || turnoGato !== miFicha || tablero[posicion] !== "") return;
    
    tablero[posicion] = miFicha;
    turnoGato = miFicha === "X" ? "O" : "X"; 
    
    actualizarTableroVisual();
    verificarGanadorGato();
    
    // Envía la jugada al rival
    socket.emit('accion_minijuego', { tipo: 'jugada_gato', tablero: tablero, turnoGato: turnoGato });
}

function actualizarTableroVisual() {
    const celdas = document.querySelectorAll('.celda-gato');
    celdas.forEach((celda, i) => {
        celda.innerText = tablero[i];
        // Estilo rápido para diferenciar X de O
        if(tablero[i] === "X") celda.style.color = "#00a884";
        if(tablero[i] === "O") celda.style.color = "#ea0038";
    });
    
    const indicador = document.getElementById('gato-turno');
    if (turnoGato === "FIN") return;
    
    if (turnoGato === miFicha) {
        indicador.innerText = `Tu turno (${miFicha})`;
    } else {
        indicador.innerText = "Esperando la jugada del rival...";
    }
}

function limpiarInterfazGato() {
    const celdas = document.querySelectorAll('.celda-gato');
    celdas.forEach(celda => {
        celda.innerText = "";
        celda.style.color = "white";
    });
}

function reiniciarGato() {
    if (confirm("¿Quieres reiniciar el tablero? Se vaciarán las casillas.")) {
        iniciarGato();
    }
}

function verificarGanadorGato() {
    // Combinaciones de victoria indexadas correctamente
    const combinaciones = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontales
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticales
        [0, 4, 8], [2, 4, 6]             // Diagonales
    ];
    
    for (let combo of combinaciones) {
        const [a, b, c] = combo;
        if (tablero[a] && tablero[a] === tablero[b] && tablero[a] === tablero[c]) {
            const ganador = tablero[a];
            document.getElementById('gato-turno').innerText = ganador === miFicha ? "¡Ganaste la partida! 🎉" : "El rival ha ganado 😢";
            turnoGato = "FIN";
            juegoActivo = false;
            return;
        }
    }
    
    if (!tablero.includes("")) {
        document.getElementById('gato-turno').innerText = "¡Empate técnico!";
        turnoGato = "FIN";
        juegoActivo = false;
    }
}

// RECEPCIÓN DE ACCIONES DE MINIJUEGOS EN TIEMPO REAL
socket.on('recibir_minijuego', (data) => {
    notificarActividadJuego(); // Activa parpadeo si el menú está cerrado

    // Sincronizar apertura del Gato (Jugador 2)
    if (data.tipo === 'abrir_gato') {
        miFicha = "O";
        tablero = data.tablero;
        turnoGato = data.turnoGato;
        juegoActivo = true;
        limpiarInterfazGato();
        document.getElementById('juego-gato').classList.remove('oculto');
        actualizarTableroVisual();
    }

    // Sincronizar movimientos del Gato en tiempo real
    if (data.tipo === 'jugada_gato') {
        tablero = data.tablero;
        turnoGato = data.turnoGato;
        actualizarTableroVisual();
        verificarGanadorGato();
    }

    // Informar abandono de partida
    if (data.tipo === 'abandono_gato') {
        alert(`El usuario ${data.usuario} ha abandonado la partida de Gato.`);
        juegoActivo = false;
        document.getElementById('juego-gato').classList.add('oculto');
    }

    // Sincronizar petición de Verdad o Reto
    if (data.tipo === 'peticion_vr') {
        tipoElegidoPorRival = data.categoria;
        const esperaPrevio = document.getElementById('vr-espera-texto');
        if(esperaPrevio) esperaPrevio.remove();

        document.getElementById('juego-verdad-reto').classList.remove('oculto');
        document.getElementById('vr-pantalla-seleccion').classList.add('oculto');
        document.getElementById('vr-pantalla-redaccion').classList.remove('oculto');
        
        document.getElementById('vr-titulo').innerText = "¡Te toca inventar!";
        document.getElementById('vr-aviso-rival').innerText = `¡${data.solicitante} pide ${data.categoria.toUpperCase()}!`;
        document.getElementById('vr-input-desafio').placeholder = data.categoria === 'verdad' ? 'Escribe la pregunta...' : 'Escribe el reto...';
    }

        // Sincronizar apertura de Piedra, Papel o Tijera (Jugador 2)
    if (data.tipo === 'abrir_ppt') {
        miEleccionPPT = "";
        eleccionRivalPPT = "";
        document.getElementById('juego-ppt').classList.remove('oculto');
        document.getElementById('ppt-estado').innerText = "Tu rival te desafía. ¡Elige tu jugada!";
        document.getElementById('ppt-resultado').innerText = "";
        ['piedra', 'papel', 'tijera'].forEach(op => {
            const btn = document.getElementById(`btn-ppt-${op}`);
            btn.disabled = false;
            btn.style.background = "#2a3942";
        });
    }

    // Recibir la jugada secreta del oponente
    if (data.tipo === 'jugada_ppt') {
        eleccionRivalPPT = data.eleccion;
        
        // Si tú ya habías elegido, calcula el ganador de inmediato
        if (miEleccionPPT) {
            calcularResultadoPPT();
        }
    }


});

// MULTIMEDIA Y CIERRES GENERALES
document.getElementById('archivo').addEventListener('change', (e) => {
    const file = e.target.files[0];
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

const socket = io();
let miApodo = "";

function obtenerDatos() {
    miApodo = document.getElementById('apodo').value.trim() || "Anónimo";
    return {
        apodo: miApodo,
        edad: document.getElementById('edad').value || "?",
        sexo: document.getElementById('sexo').value
    };
}

function crearSala() {
    const datos = obtenerDatos();
    socket.emit('crear_sala', datos);
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
    const compañero = usuarios.find(u => u.apodo !== miApodo) || usuarios[0];
    document.getElementById('header-titulo').innerText = compañero.apodo;
    document.getElementById('header-subtitulo').innerText = `${compañero.edad} años • ${compañero.sexo}`;
});

function enviarTexto() {
    const input = document.getElementById('texto-mensaje');
    const txt = input.value.trim();
    if(!txt) return;
    
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: txt, usuario: miApodo });
    renderizarMensaje('yo', miApodo, 'texto', txt);
    input.value = "";
}

// Control de envío de archivos (Fotos y Videos)
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

// Función para salir manualmente
function salirManualmente() {
    if(confirm("¿Seguro que quieres salir? Se destruirá todo el historial de inmediato.")) {
        window.location.reload(); 
    }
}

socket.on('chat_finalizado', () => {
    alert("El otro usuario abandonó el chat o cerró la pestaña. Historial destruido.");
    window.location.reload(); 
});

socket.on('error_ingreso', (msg) => alert(msg));

// Generador estructurado de burbujas tipo servicio de mensajería
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
    
    // Auto-scroll hacia abajo al recibir mensajes
    contenedor.scrollTop = contenedor.scrollHeight;
}

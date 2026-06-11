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

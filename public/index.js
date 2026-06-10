const socket = io();
let miApodo = "";

function obtenerDatos() {
    miApodo = document.getElementById('apodo').value || "Anónimo";
    return {
        apodo: miApodo,
        edad: document.getElementById('edad').value,
        sexo: document.getElementById('sexo').value
    };
}

function crearSala() {
    socket.emit('crear_sala', obtenerDatos());
}

function unirseSala() {
    const codigo = document.getElementById('codigo-invitacion').value.toUpperCase();
    socket.emit('unirse_sala', { codigo, datos: obtenerDatos() });
}

socket.on('sala_creada', (codigo) => {
    document.getElementById('pantalla-login').classList.add('oculto');
    document.getElementById('pantalla-chat').classList.remove('oculto');
    document.getElementById('info-sala').innerText = `Tu código de invitación es: ${codigo}`;
});

socket.on('chat_iniciado', (usuarios) => {
    document.getElementById('pantalla-login').classList.add('oculto');
    document.getElementById('pantalla-chat').classList.remove('oculto');
    const compañero = usuarios.find(u => u.apodo !== miApodo) || usuarios[0];
    document.getElementById('info-sala').innerText = `Chateando con: ${compañero.apodo} (${compañero.edad} años, ${compañero.sexo})`;
});

function enviarTexto() {
    const txt = document.getElementById('texto-mensaje').value;
    if(!txt) return;
    socket.emit('enviar_mensaje', { tipo: 'texto', contenido: txt, usuario: miApodo });
    mostrarMensaje(`Tú: ${txt}`);
    document.getElementById('texto-mensaje').value = "";
}

// Escucha la carga de fotos o videos locales
document.getElementById('archivo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const tipo = file.type.startsWith('image') ? 'foto' : 'video';
        socket.emit('enviar_mensaje', { tipo: tipo, contenido: reader.result, usuario: miApodo });
        mostrarArchivo('Tú', tipo, reader.result);
    };
    reader.readAsDataURL(file);
});

socket.on('recibir_mensaje', (data) => {
    if (data.tipo === 'texto') mostrarMensaje(`${data.usuario}: ${data.contenido}`);
    else mostrarArchivo(data.usuario, data.tipo, data.contenido);
});

socket.on('chat_finalizado', () => {
    alert("El otro usuario salió. Todo el historial se ha autodestruido.");
    window.location.reload(); // Borra todo de la pantalla al reiniciar la página
});

socket.on('error_ingreso', (msg) => alert(msg));

function mostrarMensaje(msg) {
    const p = document.createElement('p');
    p.innerText = msg;
    document.getElementById('caja-mensajes').appendChild(p);
}

function mostrarArchivo(usuario, tipo, fuente) {
    const contenedor = document.getElementById('caja-mensajes');
    const p = document.createElement('p');
    p.innerText = `${usuario}:`;
    contenedor.appendChild(p);
    
    const elemento = document.createElement(tipo === 'foto' ? 'img' : 'video');
    elemento.src = fuente;
    if(tipo === 'video') elemento.controls = true;
    contenedor.appendChild(elemento);
}

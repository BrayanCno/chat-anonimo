const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e7 }); // Permite fotos/videos de hasta 10MB

const salas = {}; 

app.use(express.static(__dirname + '/public')); // Sirve la pantalla visual

io.on('connection', (socket) => {
  
  socket.on('crear_sala', (datos) => {
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    salas[codigo] = { usuarios: [datos] };
    socket.join(codigo);
    socket.codigoSala = codigo;
    socket.emit('sala_creada', codigo);
  });

  socket.on('unirse_sala', ({ codigo, datos }) => {
    if (salas[codigo] && salas[codigo].usuarios.length < 2) {
      salas[codigo].usuarios.push(datos);
      socket.join(codigo);
      socket.codigoSala = codigo;
      io.to(codigo).emit('chat_iniciado', salas[codigo].usuarios);
    } else {
      socket.emit('error_ingreso', 'Código inválido o sala llena');
    }
  });

  socket.on('enviar_mensaje', (data) => {
    socket.to(socket.codigoSala).emit('recibir_mensaje', data);
  });

    // Detectar cuando el usuario está escribiendo
  socket.on('usuario_escribiendo', (estaEscribiendo) => {
    socket.to(socket.codigoSala).emit('otro_escribiendo', estaEscribiendo);
  });


  socket.on('disconnect', () => {
    const codigo = socket.codigoSala;
    if (codigo && salas[codigo]) {
      io.to(codigo).emit('chat_finalizado');
      delete salas[codigo]; // Borrado absoluto e inmediato de la memoria RAM
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`¡Servidor listo en el puerto ${PORT}!`));


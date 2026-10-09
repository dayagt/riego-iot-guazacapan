// =====================================================================
// Rutas /api/auth — inicio de sesión
//   POST /api/auth/login     { correo, contrasena } -> { token, usuario }
//   GET  /api/auth/yo        datos del usuario con sesión iniciada
//   GET  /api/auth/usuarios  lista de usuarios (solo coordinador)
// =====================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { crearToken, requiereRol, requiereSesion } from '../middleware/auth';
import { ErrorHttp, textoObligatorio } from '../utils/http';
import type { Rol } from '../tipos';

export const rutasAuth = Router();

interface FilaUsuario {
  idUsuario: number;
  nombre: string;
  rol: Rol;
  correo: string;
  contrasenaHash: string;
}

rutasAuth.post('/login', (req, res) => {
  const correo = textoObligatorio(req.body?.correo, 100, 'correo').toLowerCase();
  const contrasena = textoObligatorio(req.body?.contrasena, 100, 'contrasena');

  const usuario = db.prepare('SELECT * FROM Usuario WHERE correo = ?').get(correo) as FilaUsuario | undefined;

  // bcrypt compara la contraseña escrita con el hash guardado.
  // Se usa el mismo mensaje en ambos casos para no revelar qué correos existen.
  if (!usuario || !bcrypt.compareSync(contrasena, usuario.contrasenaHash)) {
    throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
  }

  const datos = { idUsuario: usuario.idUsuario, nombre: usuario.nombre, rol: usuario.rol };
  res.json({ token: crearToken(datos), usuario: { ...datos, correo: usuario.correo } });
});

rutasAuth.get('/yo', requiereSesion, (req, res) => {
  res.json(req.usuario);
});

rutasAuth.get('/usuarios', requiereSesion, requiereRol('coordinador'), (_req, res) => {
  res.json(db.prepare('SELECT idUsuario, nombre, rol, correo FROM Usuario ORDER BY idUsuario').all());
});

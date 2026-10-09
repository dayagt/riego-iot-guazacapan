// =====================================================================
// Middlewares de seguridad
// ---------------------------------------------------------------------
//  * requiereSesion      -> el usuario del panel debe enviar un JWT válido
//                           en la cabecera "Authorization: Bearer <token>".
//  * requiereRol(...)    -> además, su rol debe estar en la lista permitida.
//  * requiereDispositivo -> el ESP32 / simulador debe enviar la clave
//                           "x-api-key" definida en el .env.
// =====================================================================
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ErrorHttp } from '../utils/http';
import type { Rol, UsuarioToken } from '../tipos';

// Le indicamos a TypeScript que "req.usuario" existe después del login
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

/** Crea el token JWT con los datos básicos del usuario. */
export function crearToken(usuario: UsuarioToken): string {
  return jwt.sign(usuario, config.jwtSecreto, {
    expiresIn: config.jwtExpira as jwt.SignOptions['expiresIn'],
  });
}

/** Verifica un token y devuelve el usuario; lanza 401 si no es válido. */
export function verificarToken(token: string): UsuarioToken {
  try {
    const datos = jwt.verify(token, config.jwtSecreto) as UsuarioToken;
    return { idUsuario: datos.idUsuario, nombre: datos.nombre, rol: datos.rol };
  } catch {
    throw new ErrorHttp(401, 'La sesión no es válida o ya expiró. Inicie sesión de nuevo.');
  }
}

/** Exige un usuario con sesión iniciada (JWT). */
export function requiereSesion(req: Request, _res: Response, next: NextFunction): void {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new ErrorHttp(401, 'Debe iniciar sesión.');
  }
  req.usuario = verificarToken(token);
  next();
}

/** Exige que el usuario tenga alguno de los roles indicados. */
export function requiereRol(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      throw new ErrorHttp(403, `Esta acción solo está permitida para: ${roles.join(', ')}.`);
    }
    next();
  };
}

/** Exige la clave del dispositivo (ESP32 o simulador). */
export function requiereDispositivo(req: Request, _res: Response, next: NextFunction): void {
  const recibida = Buffer.from(String(req.headers['x-api-key'] ?? ''));
  const esperada = Buffer.from(config.dispositivoApiKey);
  // timingSafeEqual compara sin revelar, por el tiempo de respuesta, cuántos caracteres coinciden
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) {
    throw new ErrorHttp(401, 'Clave de dispositivo inválida.');
  }
  next();
}

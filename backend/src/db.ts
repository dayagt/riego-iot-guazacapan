// =====================================================================
// Conexión a la base de datos SQLite
// ---------------------------------------------------------------------
// Usamos el módulo "node:sqlite" que ya viene incluido en Node.js 22,
// por lo que no hay que instalar un servidor de base de datos: toda la
// información queda en un solo archivo (database/riego.db).
//
// Al abrir la conexión:
//   1. Se ejecuta database/sqlite.sql (crea las tablas si no existen).
//   2. Si la base está vacía, se cargan los datos de prueba (seed).
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { ahora } from './utils/fecha';

// Usuarios de prueba (uno por rol). Se documentan en el README.
export const USUARIOS_PRUEBA = [
  { nombre: 'Juan Pérez', rol: 'agricultor', correo: 'agricultor@riego.local', contrasena: 'agricultor123' },
  { nombre: 'Técnico IoT', rol: 'tecnico', correo: 'tecnico@riego.local', contrasena: 'tecnico123' },
  { nombre: 'Ana Morales', rol: 'coordinador', correo: 'coordinador@riego.local', contrasena: 'coordinador123' },
] as const;

/** Abre (o crea) la base de datos, aplica el esquema y carga los datos de prueba. */
function abrirBaseDatos(): DatabaseSync {
  // Crea la carpeta database/ si no existiera
  fs.mkdirSync(path.dirname(config.dbArchivo), { recursive: true });

  const db = new DatabaseSync(config.dbArchivo);

  // 1. Esquema: el mismo archivo SQL que se muestra en la documentación
  const esquema = fs.readFileSync(config.esquemaSql, 'utf8');
  db.exec(esquema);

  // 2. Datos de prueba, solo la primera vez (cuando no hay usuarios)
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM Usuario').get() as { total: number };
  if (total === 0) {
    cargarDatosPrueba(db);
  }

  return db;
}

/** Inserta los datos iniciales necesarios para la demostración. */
function cargarDatosPrueba(db: DatabaseSync): void {
  const fecha = ahora();

  // Se usa una transacción: o se guarda todo, o no se guarda nada.
  db.exec('BEGIN');
  try {
    // Usuarios (la contraseña se guarda cifrada con bcrypt, nunca en texto plano)
    const insertarUsuario = db.prepare(
      'INSERT INTO Usuario (nombre, rol, correo, contrasenaHash) VALUES (?, ?, ?, ?)',
    );
    const ids: Record<string, number> = {};
    for (const u of USUARIOS_PRUEBA) {
      const hash = bcrypt.hashSync(u.contrasena, 10);
      const resultado = insertarUsuario.run(u.nombre, u.rol, u.correo, hash);
      ids[u.rol] = Number(resultado.lastInsertRowid);
    }

    // Microcontrolador ESP32 registrado por el técnico (el simulador usará idMicro = 1)
    db.prepare(
      'INSERT INTO Microcontrolador (Modelo, estado, ip, fechaRegistro, idUsuario) VALUES (?, ?, ?, ?, ?)',
    ).run('ESP32 DevKit V1', 'ACTIVO', '192.168.1.50', fecha, ids.tecnico);

    // Umbral inicial configurado por el técnico
    db.prepare(
      'INSERT INTO Configuracion (umbralHumedad, idUsuario, fechaHora) VALUES (?, ?, ?)',
    ).run(config.umbralInicial, ids.tecnico, fecha);

    // Estado inicial de la bomba: apagada
    db.prepare(
      "INSERT INTO ActuadorBomba (estado, fechaHora, idMicro, modo) VALUES ('OFF', ?, 1, 'AUTO')",
    ).run(fecha);

    // Expediente de ejemplo (parcela del agricultor)
    db.prepare(
      'INSERT INTO Expediente (parcela, cultivo, areaM2, ubicacion, idUsuario) VALUES (?, ?, ?, ?, ?)',
    ).run('Parcela 1', 'Maíz', 2500, 'Guazacapán, Santa Rosa', ids.agricultor);

    db.exec('COMMIT');
    console.log('[db] Datos de prueba cargados.');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Conexión única que comparte todo el backend
export const db = abrirBaseDatos();

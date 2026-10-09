// =====================================================================
// Script de revisión de la base de datos
//   npm run db:revisar    -> crea la BD (si no existe) y muestra su contenido
//   npm run db:reiniciar  -> borra la BD y la vuelve a crear desde cero
// =====================================================================
import fs from 'node:fs';
import { config } from '../config';

// Si se pidió reiniciar, se borra el archivo ANTES de abrir la conexión
if (process.argv.includes('--reiniciar')) {
  for (const sufijo of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(config.dbArchivo + sufijo, { force: true });
  }
  console.log('[db] Base de datos eliminada, se creará de nuevo.');
}

// Importación dinámica: así la conexión se abre DESPUÉS de borrar el archivo
const { db } = await import('../db');

console.log(`\nArchivo: ${config.dbArchivo}\n`);

const tablas = ['Usuario', 'Microcontrolador', 'SensorHumedad', 'ActuadorBomba', 'Configuracion', 'Expediente'];

for (const tabla of tablas) {
  // Columnas de la tabla (nombre y tipo) según SQLite
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string; type: string }[];
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${tabla}`).get() as { total: number };

  console.log(`== ${tabla} (${total} registros)`);
  console.log('   Columnas: ' + columnas.map((c) => `${c.name} ${c.type}`).join(', '));

  // Muestra los últimos 5 registros; se oculta el hash de la contraseña
  const filas = db.prepare(`SELECT * FROM ${tabla} ORDER BY 1 DESC LIMIT 5`).all();
  if (filas.length > 0) {
    console.table(filas.map((f) => ({ ...f, ...('contrasenaHash' in f ? { contrasenaHash: '(cifrada)' } : {}) })));
  }
  console.log();
}

db.close();

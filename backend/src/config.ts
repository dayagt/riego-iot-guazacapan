// =====================================================================
// Configuración general del backend
// Lee el archivo .env de la raíz del proyecto y expone los valores
// ya convertidos a su tipo (número, texto) para el resto del código.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';

// Carpeta raíz del proyecto (RiegoIoT/), dos niveles arriba de backend/src
export const RAIZ_PROYECTO = path.resolve(import.meta.dirname, '..', '..');

// Node 22 trae un lector de .env incluido (process.loadEnvFile),
// así que no necesitamos instalar la librería "dotenv".
const archivoEnv = path.join(RAIZ_PROYECTO, '.env');
if (fs.existsSync(archivoEnv)) {
  process.loadEnvFile(archivoEnv);
} else {
  console.warn('[config] No se encontró .env; se usan valores por defecto (copia .env.example como .env).');
}

/** Lee una variable de entorno numérica, con valor por defecto. */
function numero(nombre: string, porDefecto: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) ? valor : porDefecto;
}

export const config = {
  puerto: numero('PUERTO', 3000),
  dbArchivo: path.resolve(RAIZ_PROYECTO, process.env.DB_ARCHIVO ?? 'database/riego.db'),
  esquemaSql: path.join(RAIZ_PROYECTO, 'database', 'sqlite.sql'),
  jwtSecreto: process.env.JWT_SECRETO ?? 'secreto_solo_para_desarrollo',
  jwtExpira: process.env.JWT_EXPIRA ?? '8h',
  dispositivoApiKey: process.env.DISPOSITIVO_API_KEY ?? 'clave_dispositivo_desarrollo',
  umbralInicial: numero('UMBRAL_INICIAL', 35),
  caudalBombaLpm: numero('CAUDAL_BOMBA_LPM', 10),
  margenApagado: numero('MARGEN_APAGADO', 10),
  manualDuracionSeg: numero('MANUAL_DURACION_SEG', 60),
};

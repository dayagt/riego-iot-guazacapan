// =====================================================================
// Servicio de configuración (umbral de humedad)
// ---------------------------------------------------------------------
// Cada vez que alguien guarda un umbral se INSERTA una fila nueva en
// Configuracion (no se sobrescribe). El umbral vigente es el último
// registrado, y así queda el historial de quién lo cambió y cuándo.
// =====================================================================
import { db } from '../db';
import { config } from '../config';
import { ahora } from '../utils/fecha';
import { eventos } from './eventos';
import type { ConfiguracionActual } from '../tipos';

const SQL_CONFIGURACION = `
  SELECT c.idConfig, c.umbralHumedad, c.fechaHora, c.idUsuario,
         u.nombre AS configuradoPor, u.rol AS rolConfigurador
  FROM Configuracion c
  LEFT JOIN Usuario u ON u.idUsuario = c.idUsuario
  ORDER BY c.idConfig DESC`;

/** Devuelve la configuración vigente (la más reciente). */
export function configuracionActual(): ConfiguracionActual | undefined {
  return db.prepare(SQL_CONFIGURACION + ' LIMIT 1').get() as ConfiguracionActual | undefined;
}

/** Umbral vigente; si no hay ninguno guardado, usa el del .env. */
export function umbralActual(): number {
  return configuracionActual()?.umbralHumedad ?? config.umbralInicial;
}

/** Historial de cambios de umbral (más recientes primero). */
export function historialConfiguracion(limite: number): ConfiguracionActual[] {
  return db.prepare(SQL_CONFIGURACION + ' LIMIT ?').all(limite) as unknown as ConfiguracionActual[];
}

/** Guarda un nuevo umbral y avisa al panel en tiempo real. */
export function guardarUmbral(umbralHumedad: number, idUsuario: number): ConfiguracionActual {
  db.prepare('INSERT INTO Configuracion (umbralHumedad, idUsuario, fechaHora) VALUES (?, ?, ?)').run(
    umbralHumedad,
    idUsuario,
    ahora(),
  );
  const actual = configuracionActual()!;
  eventos.emit('configuracion', actual);
  return actual;
}

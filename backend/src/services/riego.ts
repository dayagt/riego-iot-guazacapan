// =====================================================================
// Servicio de riego: el "cerebro" del sistema
// ---------------------------------------------------------------------
// Reglas del control automático (se aplican en cada lectura de humedad):
//
//   1. Si la humedad está DEBAJO del umbral y la bomba está apagada
//      -> se ENCIENDE (modo AUTO).
//   2. Si la humedad llega a (umbral + margen) y la bomba está encendida
//      -> se APAGA (modo AUTO).
//      El margen (histéresis) evita que la bomba se prenda y apague a
//      cada rato cuando la humedad ronda el umbral.
//   3. Si una persona encendió o apagó la bomba desde el panel (MANUAL),
//      esa orden se respeta durante MANUAL_DURACION_SEG segundos; después
//      el control automático vuelve a decidir.
//
// El estado actual de la bomba es siempre el ÚLTIMO registro de
// ActuadorBomba, por lo que la tabla funciona también como historial.
// =====================================================================
import { db } from '../db';
import { config } from '../config';
import { ahora, desdeDatetime, inicioDeHoy } from '../utils/fecha';
import { ErrorHttp } from '../utils/http';
import { eventos } from './eventos';
import { umbralActual } from './configuracion';
import type { EstadoBomba, Lectura, ModoBomba, NivelHumedad, RegistroBomba } from '../tipos';

// ---------------------------------------------------------------------
// Consultas de estado
// ---------------------------------------------------------------------

/** Último registro de la bomba (= estado actual). */
export function estadoBomba(idMicro: number): RegistroBomba | undefined {
  return db
    .prepare('SELECT * FROM ActuadorBomba WHERE idMicro = ? ORDER BY idBomba DESC LIMIT 1')
    .get(idMicro) as RegistroBomba | undefined;
}

/**
 * Si la última orden fue MANUAL y aún no pasa el tiempo de respeto,
 * devuelve hasta qué momento sigue vigente; si no, devuelve null.
 */
export function controlManualHasta(bomba: RegistroBomba | undefined): Date | null {
  if (!bomba || bomba.modo !== 'MANUAL') return null;
  const hasta = new Date(desdeDatetime(bomba.fechaHora).getTime() + config.manualDuracionSeg * 1000);
  return hasta > new Date() ? hasta : null;
}

/** Clasifica la humedad: CRITICO si está por debajo del umbral. */
export function nivelHumedad(valor: number, umbral: number): NivelHumedad {
  return valor < umbral ? 'CRITICO' : 'NORMAL';
}

/** Verifica que el microcontrolador exista y esté ACTIVO. */
function verificarMicrocontrolador(idMicro: number): void {
  const micro = db.prepare('SELECT estado FROM Microcontrolador WHERE idMicro = ?').get(idMicro) as
    | { estado: string }
    | undefined;
  if (!micro) throw new ErrorHttp(404, `El microcontrolador ${idMicro} no está registrado.`);
  if (micro.estado !== 'ACTIVO') throw new ErrorHttp(403, `El microcontrolador ${idMicro} está INACTIVO.`);
}

// ---------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------

/**
 * Cambia el estado de la bomba y lo guarda en ActuadorBomba.
 * Si la bomba ya estaba en ese estado no se crea un registro repetido.
 */
export function cambiarBomba(idMicro: number, estado: EstadoBomba, modo: ModoBomba): RegistroBomba {
  verificarMicrocontrolador(idMicro);
  const actual = estadoBomba(idMicro);
  if (actual?.estado === estado) return actual;

  const resultado = db
    .prepare('INSERT INTO ActuadorBomba (estado, fechaHora, idMicro, modo) VALUES (?, ?, ?, ?)')
    .run(estado, ahora(), idMicro, modo);

  const registro = db
    .prepare('SELECT * FROM ActuadorBomba WHERE idBomba = ?')
    .get(resultado.lastInsertRowid) as unknown as RegistroBomba;

  eventos.emit('bomba', registro); // aviso en tiempo real al panel
  return registro;
}

/**
 * Procesa una lectura enviada por el ESP32 (o el simulador):
 * la guarda, aplica las reglas automáticas y responde qué debe hacer la bomba.
 */
export function procesarLectura(idMicro: number, valorHumedad: number) {
  verificarMicrocontrolador(idMicro);

  // 1. Guardar la lectura en SensorHumedad
  const resultado = db
    .prepare('INSERT INTO SensorHumedad (valorHumedad, fechaHora, idMicro) VALUES (?, ?, ?)')
    .run(valorHumedad, ahora(), idMicro);
  const lectura = db
    .prepare('SELECT * FROM SensorHumedad WHERE idSensorHumedad = ?')
    .get(resultado.lastInsertRowid) as unknown as Lectura;

  const umbral = umbralActual();
  const nivel = nivelHumedad(valorHumedad, umbral);
  eventos.emit('lectura', { lectura, nivel, umbral });

  // 2. Decidir si la bomba debe cambiar (reglas del encabezado)
  let bomba = estadoBomba(idMicro);
  if (!controlManualHasta(bomba)) {
    if (valorHumedad < umbral && bomba?.estado !== 'ON') {
      bomba = cambiarBomba(idMicro, 'ON', 'AUTO');
    } else if (valorHumedad >= umbral + config.margenApagado && bomba?.estado === 'ON') {
      bomba = cambiarBomba(idMicro, 'OFF', 'AUTO');
    }
  }

  // 3. Respuesta para el dispositivo: con "bomba" sabe si activar el relé
  return {
    lectura,
    nivel,
    umbral,
    bomba: bomba?.estado ?? 'OFF',
  };
}

// ---------------------------------------------------------------------
// Historial y resumen de agua
// ---------------------------------------------------------------------

/** Historial de cambios de la bomba (más recientes primero). */
export function historialBomba(idMicro: number, limite: number): RegistroBomba[] {
  return db
    .prepare('SELECT * FROM ActuadorBomba WHERE idMicro = ? ORDER BY idBomba DESC LIMIT ?')
    .all(idMicro, limite) as unknown as RegistroBomba[];
}

/**
 * Calcula cuánto tiempo estuvo encendida la bomba desde una fecha
 * y estima el agua usada: litros = minutos encendida × caudal (L/min).
 * Recorre los registros ON/OFF en orden y suma cada intervalo ON -> OFF.
 */
function calcularUsoAgua(idMicro: number, desde: string | null) {
  const inicio = desde ? desdeDatetime(desde).getTime() : null;
  let encendidaDesde: number | null = null;
  let milisegundos = 0;
  let activacionesAuto = 0;
  let activacionesManual = 0;

  // Si la bomba ya venía encendida antes del periodo, se cuenta desde el inicio
  if (desde && inicio !== null) {
    const previo = db
      .prepare('SELECT estado FROM ActuadorBomba WHERE idMicro = ? AND fechaHora < ? ORDER BY idBomba DESC LIMIT 1')
      .get(idMicro, desde) as { estado: EstadoBomba } | undefined;
    if (previo?.estado === 'ON') encendidaDesde = inicio;
  }

  const registros = db
    .prepare('SELECT estado, fechaHora, modo FROM ActuadorBomba WHERE idMicro = ? AND fechaHora >= ? ORDER BY idBomba')
    .all(idMicro, desde ?? '') as unknown as RegistroBomba[];

  for (const r of registros) {
    const momento = desdeDatetime(r.fechaHora).getTime();
    if (r.estado === 'ON' && encendidaDesde === null) {
      encendidaDesde = momento;
      if (r.modo === 'MANUAL') activacionesManual++;
      else activacionesAuto++;
    } else if (r.estado === 'OFF' && encendidaDesde !== null) {
      milisegundos += momento - encendidaDesde;
      encendidaDesde = null;
    }
  }
  // Si sigue encendida, se cuenta hasta este momento
  if (encendidaDesde !== null) milisegundos += Date.now() - encendidaDesde;

  const minutos = milisegundos / 60000;
  return {
    minutosEncendida: Number(minutos.toFixed(2)),
    litrosEstimados: Number((minutos * config.caudalBombaLpm).toFixed(1)),
    activaciones: activacionesAuto + activacionesManual,
    activacionesAuto,
    activacionesManual,
  };
}

/** Resumen de agua usada hoy y en total (apoya la comparación con riego manual). */
export function resumenAgua(idMicro: number) {
  return {
    caudalLitrosPorMinuto: config.caudalBombaLpm,
    hoy: calcularUsoAgua(idMicro, inicioDeHoy()),
    total: calcularUsoAgua(idMicro, null),
  };
}

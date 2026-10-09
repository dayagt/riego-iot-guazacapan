// =====================================================================
// Tipos de datos compartidos por el backend
// Cada interfaz corresponde a una tabla del esquema SistemaRiego.
// =====================================================================

/** Roles definidos en la tesis (2.1.3). */
export const ROLES = ['agricultor', 'tecnico', 'coordinador'] as const;
export type Rol = (typeof ROLES)[number];

/** Datos del usuario que viajan dentro del token JWT. */
export interface UsuarioToken {
  idUsuario: number;
  nombre: string;
  rol: Rol;
}

/** Fila de la tabla SensorHumedad. */
export interface Lectura {
  idSensorHumedad: number;
  valorHumedad: number;
  fechaHora: string;
  idMicro: number;
}

export type EstadoBomba = 'ON' | 'OFF';
export type ModoBomba = 'AUTO' | 'MANUAL';

/** Fila de la tabla ActuadorBomba. */
export interface RegistroBomba {
  idBomba: number;
  estado: EstadoBomba;
  fechaHora: string;
  idMicro: number;
  modo: ModoBomba;
}

/** Fila de la tabla Configuracion + nombre de quien la guardó. */
export interface ConfiguracionActual {
  idConfig: number;
  umbralHumedad: number;
  fechaHora: string | null;
  idUsuario: number | null;
  configuradoPor: string | null;
  rolConfigurador: string | null;
}

/** Nivel de humedad que se muestra en el panel. */
export type NivelHumedad = 'CRITICO' | 'NORMAL';

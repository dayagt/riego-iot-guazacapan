// =====================================================================
// Utilidades de fecha
// Las columnas DATETIME se guardan con el formato 'AAAA-MM-DD HH:MM:SS'
// (hora local, Guatemala), igual que el tipo DATETIME de MySQL.
// =====================================================================

/** Agrega un cero a la izquierda: 7 -> "07". */
const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Convierte una fecha al formato DATETIME 'AAAA-MM-DD HH:MM:SS'. */
export function aDatetime(fecha: Date): string {
  return (
    `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())} ` +
    `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`
  );
}

/** Fecha y hora actual en formato DATETIME. */
export function ahora(): string {
  return aDatetime(new Date());
}

/** Convierte un texto DATETIME 'AAAA-MM-DD HH:MM:SS' (hora local) a Date. */
export function desdeDatetime(texto: string): Date {
  // Con la "T" en medio, JavaScript lo interpreta como hora local
  return new Date(texto.replace(' ', 'T'));
}

/** Inicio del día actual (00:00:00) en formato DATETIME. */
export function inicioDeHoy(): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return aDatetime(hoy);
}

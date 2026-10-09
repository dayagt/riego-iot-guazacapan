// =====================================================================
// Utilidades para las respuestas HTTP y la validación de datos
// =====================================================================

/**
 * Error con código HTTP. Cuando una ruta lanza un ErrorHttp, el manejador
 * de errores (app.ts) responde con ese código y el mensaje en español.
 */
export class ErrorHttp extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** Valida que un valor sea un número dentro de un rango; si no, lanza 400. */
export function numeroEntre(valor: unknown, min: number, max: number, campo: string): number {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
    throw new ErrorHttp(400, `El campo "${campo}" debe ser un número entre ${min} y ${max}.`);
  }
  return n;
}

/** Valida un texto obligatorio con longitud máxima (como VARCHAR(n)). */
export function textoObligatorio(valor: unknown, maximo: number, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorHttp(400, `El campo "${campo}" es obligatorio.`);
  }
  if (valor.trim().length > maximo) {
    throw new ErrorHttp(400, `El campo "${campo}" admite como máximo ${maximo} caracteres.`);
  }
  return valor.trim();
}

/** Valida un texto opcional; devuelve null si viene vacío. */
export function textoOpcional(valor: unknown, maximo: number, campo: string): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return textoObligatorio(valor, maximo, campo);
}

/** Lee el parámetro ?limite= de la URL (cantidad de registros a devolver). */
export function limiteConsulta(valor: unknown, porDefecto = 50, maximo = 500): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? Math.min(n, maximo) : porDefecto;
}

/** Lee el parámetro ?idMicro= (por defecto el microcontrolador 1). */
export function idMicroConsulta(valor: unknown): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

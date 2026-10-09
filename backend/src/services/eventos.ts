// =====================================================================
// Canal interno de eventos
// ---------------------------------------------------------------------
// Los servicios avisan aquí cada vez que ocurre algo importante
// (nueva lectura, cambio de bomba, nuevo umbral). En la fase 3, el
// módulo de tiempo real (Socket.IO) escucha estos eventos y los reenvía
// al panel web. Así la lógica del riego no depende de Socket.IO.
// =====================================================================
import { EventEmitter } from 'node:events';
import type { ConfiguracionActual, Lectura, NivelHumedad, RegistroBomba } from '../tipos';

interface MapaEventos {
  lectura: [{ lectura: Lectura; nivel: NivelHumedad; umbral: number }];
  bomba: [RegistroBomba];
  configuracion: [ConfiguracionActual];
}

export const eventos = new EventEmitter<MapaEventos>();

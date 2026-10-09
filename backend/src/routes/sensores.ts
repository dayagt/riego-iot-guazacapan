// =====================================================================
// Rutas /api/sensores — lecturas de humedad
//   POST /api/sensores          (dispositivo, x-api-key) { idMicro, valorHumedad }
//                               -> guarda la lectura y responde el estado de la bomba
//   GET  /api/sensores          (sesión) últimas lecturas, de la más antigua a la más nueva
//   GET  /api/sensores/ultima   (sesión) lectura más reciente + nivel (CRITICO/NORMAL)
// =====================================================================
import { Router } from 'express';
import { db } from '../db';
import { requiereDispositivo, requiereSesion } from '../middleware/auth';
import { idMicroConsulta, limiteConsulta, numeroEntre } from '../utils/http';
import { nivelHumedad, procesarLectura } from '../services/riego';
import { umbralActual } from '../services/configuracion';
import type { Lectura } from '../tipos';

export const rutasSensores = Router();

// El ESP32 (o el simulador) envía aquí cada lectura
rutasSensores.post('/', requiereDispositivo, (req, res) => {
  const idMicro = idMicroConsulta(req.body?.idMicro);
  const valorHumedad = numeroEntre(req.body?.valorHumedad, 0, 100, 'valorHumedad');
  res.status(201).json(procesarLectura(idMicro, valorHumedad));
});

rutasSensores.get('/', requiereSesion, (req, res) => {
  const idMicro = idMicroConsulta(req.query.idMicro);
  const limite = limiteConsulta(req.query.limite);
  const lecturas = db
    .prepare('SELECT * FROM SensorHumedad WHERE idMicro = ? ORDER BY idSensorHumedad DESC LIMIT ?')
    .all(idMicro, limite) as unknown as Lectura[];
  // Se invierte para que la gráfica las dibuje en orden cronológico
  res.json(lecturas.reverse());
});

rutasSensores.get('/ultima', requiereSesion, (req, res) => {
  const idMicro = idMicroConsulta(req.query.idMicro);
  const lectura = db
    .prepare('SELECT * FROM SensorHumedad WHERE idMicro = ? ORDER BY idSensorHumedad DESC LIMIT 1')
    .get(idMicro) as Lectura | undefined;
  const umbral = umbralActual();
  res.json({
    lectura: lectura ?? null,
    umbral,
    nivel: lectura ? nivelHumedad(lectura.valorHumedad, umbral) : null,
  });
});

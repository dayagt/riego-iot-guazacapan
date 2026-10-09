// =====================================================================
// Rutas /api/configuracion — umbral de humedad
//   GET /api/configuracion            umbral vigente y quién lo configuró (todos)
//   PUT /api/configuracion            { umbralHumedad } (tecnico, coordinador)
//   GET /api/configuracion/historial  cambios de umbral (todos)
// =====================================================================
import { Router } from 'express';
import { config } from '../config';
import { requiereRol, requiereSesion } from '../middleware/auth';
import { limiteConsulta, numeroEntre } from '../utils/http';
import { configuracionActual, guardarUmbral, historialConfiguracion } from '../services/configuracion';

export const rutasConfiguracion = Router();
rutasConfiguracion.use(requiereSesion);

rutasConfiguracion.get('/', (_req, res) => {
  res.json({ ...configuracionActual(), margenApagado: config.margenApagado });
});

rutasConfiguracion.put('/', requiereRol('tecnico', 'coordinador'), (req, res) => {
  // El umbral + margen no puede pasar de 100 %, si no la bomba nunca se apagaría sola
  const maximo = 100 - config.margenApagado;
  const umbral = numeroEntre(req.body?.umbralHumedad, 1, maximo, 'umbralHumedad');
  res.json(guardarUmbral(umbral, req.usuario!.idUsuario));
});

rutasConfiguracion.get('/historial', (req, res) => {
  res.json(historialConfiguracion(limiteConsulta(req.query.limite, 20)));
});

// =====================================================================
// Rutas /api/riego — control y estado de la bomba (todas requieren sesión)
//   GET  /api/riego/estado      estado actual de la bomba y del control manual
//   POST /api/riego             { accion: "ON" | "OFF" } encendido/apagado manual
//   GET  /api/riego/historial   cambios de la bomba (más recientes primero)
//   GET  /api/riego/resumen     tiempo encendida y litros estimados (hoy y total)
// Permisos: los tres roles pueden ver y operar la bomba.
// =====================================================================
import { Router } from 'express';
import { config } from '../config';
import { requiereSesion } from '../middleware/auth';
import { ErrorHttp, idMicroConsulta, limiteConsulta } from '../utils/http';
import { aDatetime } from '../utils/fecha';
import { cambiarBomba, controlManualHasta, estadoBomba, historialBomba, resumenAgua } from '../services/riego';

export const rutasRiego = Router();
rutasRiego.use(requiereSesion);

rutasRiego.get('/estado', (req, res) => {
  const bomba = estadoBomba(idMicroConsulta(req.query.idMicro));
  const manualHasta = controlManualHasta(bomba);
  res.json({
    bomba: bomba ?? null,
    controlManualHasta: manualHasta ? aDatetime(manualHasta) : null,
  });
});

rutasRiego.post('/', (req, res) => {
  const accion = String(req.body?.accion ?? '').toUpperCase();
  if (accion !== 'ON' && accion !== 'OFF') {
    throw new ErrorHttp(400, 'El campo "accion" debe ser "ON" u "OFF".');
  }
  const bomba = cambiarBomba(idMicroConsulta(req.body?.idMicro), accion, 'MANUAL');
  res.json({
    bomba,
    mensaje:
      accion === 'ON'
        ? `Riego activado manualmente. El control automático se reanuda en ${config.manualDuracionSeg} s.`
        : `Riego desactivado manualmente. El control automático se reanuda en ${config.manualDuracionSeg} s.`,
  });
});

rutasRiego.get('/historial', (req, res) => {
  res.json(historialBomba(idMicroConsulta(req.query.idMicro), limiteConsulta(req.query.limite)));
});

rutasRiego.get('/resumen', (req, res) => {
  res.json(resumenAgua(idMicroConsulta(req.query.idMicro)));
});

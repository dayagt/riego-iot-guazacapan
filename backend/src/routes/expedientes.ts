// =====================================================================
// Rutas /api/expedientes — datos básicos de parcela y cultivo
//   GET    /api/expedientes       lista (el agricultor solo ve sus parcelas)
//   GET    /api/expedientes/:id   un expediente
//   POST   /api/expedientes       crear      (coordinador)
//   PUT    /api/expedientes/:id   modificar  (coordinador)
//   DELETE /api/expedientes/:id   eliminar   (coordinador)
// =====================================================================
import { Router, type Request } from 'express';
import { db } from '../db';
import { requiereRol, requiereSesion } from '../middleware/auth';
import { ErrorHttp, numeroEntre, textoObligatorio, textoOpcional } from '../utils/http';

export const rutasExpedientes = Router();
rutasExpedientes.use(requiereSesion);

const SQL_EXPEDIENTE = `
  SELECT e.*, u.nombre AS responsable
  FROM Expediente e
  LEFT JOIN Usuario u ON u.idUsuario = e.idUsuario`;

/** Busca un expediente respetando el rol (el agricultor solo ve los suyos). */
function buscarExpediente(req: Request) {
  const id = Number(req.params.id);
  const expediente = db.prepare(SQL_EXPEDIENTE + ' WHERE e.idExpediente = ?').get(id) as
    | { idUsuario: number }
    | undefined;
  const esAjeno = req.usuario!.rol === 'agricultor' && expediente?.idUsuario !== req.usuario!.idUsuario;
  if (!expediente || esAjeno) throw new ErrorHttp(404, 'Expediente no encontrado.');
  return expediente;
}

/** Valida los datos del formulario de expediente. */
function validarExpediente(cuerpo: Record<string, unknown> = {}) {
  const datos = {
    parcela: textoObligatorio(cuerpo.parcela, 50, 'parcela'),
    cultivo: textoObligatorio(cuerpo.cultivo, 50, 'cultivo'),
    areaM2: cuerpo.areaM2 === undefined || cuerpo.areaM2 === '' ? null : numeroEntre(cuerpo.areaM2, 0, 10_000_000, 'areaM2'),
    ubicacion: textoOpcional(cuerpo.ubicacion, 100, 'ubicacion'),
    idUsuario: numeroEntre(cuerpo.idUsuario, 1, Number.MAX_SAFE_INTEGER, 'idUsuario'),
  };
  const existe = db.prepare('SELECT 1 FROM Usuario WHERE idUsuario = ?').get(datos.idUsuario);
  if (!existe) throw new ErrorHttp(400, 'El usuario responsable no existe.');
  return datos;
}

rutasExpedientes.get('/', (req, res) => {
  const { rol, idUsuario } = req.usuario!;
  const filas =
    rol === 'agricultor'
      ? db.prepare(SQL_EXPEDIENTE + ' WHERE e.idUsuario = ? ORDER BY e.idExpediente').all(idUsuario)
      : db.prepare(SQL_EXPEDIENTE + ' ORDER BY e.idExpediente').all();
  res.json(filas);
});

rutasExpedientes.get('/:id', (req, res) => {
  res.json(buscarExpediente(req));
});

rutasExpedientes.post('/', requiereRol('coordinador'), (req, res) => {
  const d = validarExpediente(req.body);
  const resultado = db
    .prepare('INSERT INTO Expediente (parcela, cultivo, areaM2, ubicacion, idUsuario) VALUES (?, ?, ?, ?, ?)')
    .run(d.parcela, d.cultivo, d.areaM2, d.ubicacion, d.idUsuario);
  res.status(201).json(db.prepare(SQL_EXPEDIENTE + ' WHERE e.idExpediente = ?').get(resultado.lastInsertRowid));
});

rutasExpedientes.put('/:id', requiereRol('coordinador'), (req, res) => {
  buscarExpediente(req); // 404 si no existe
  const d = validarExpediente(req.body);
  db.prepare(
    'UPDATE Expediente SET parcela = ?, cultivo = ?, areaM2 = ?, ubicacion = ?, idUsuario = ? WHERE idExpediente = ?',
  ).run(d.parcela, d.cultivo, d.areaM2, d.ubicacion, d.idUsuario, Number(req.params.id));
  res.json(buscarExpediente(req));
});

rutasExpedientes.delete('/:id', requiereRol('coordinador'), (req, res) => {
  buscarExpediente(req);
  db.prepare('DELETE FROM Expediente WHERE idExpediente = ?').run(Number(req.params.id));
  res.status(204).end();
});

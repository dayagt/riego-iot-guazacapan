// =====================================================================
// Aplicación Express: une todas las rutas de la API REST
// ---------------------------------------------------------------------
// Todas las rutas llevan el prefijo /api (ej. /api/sensores) para que no
// choquen con las páginas del panel web, que se servirá desde el mismo
// servidor en la fase 4.
// =====================================================================
import express, { type NextFunction, type Request, type Response } from 'express';
import { ErrorHttp } from './utils/http';
import { rutasAuth } from './routes/auth';
import { rutasSensores } from './routes/sensores';
import { rutasRiego } from './routes/riego';
import { rutasConfiguracion } from './routes/configuracion';
import { rutasExpedientes } from './routes/expedientes';

export const app = express();

app.disable('x-powered-by'); // no anunciar qué tecnología usa el servidor
app.use(express.json()); // convierte el cuerpo JSON de las peticiones en objeto

// Endpoints definidos en la tesis
app.use('/api/auth', rutasAuth);
app.use('/api/sensores', rutasSensores);
app.use('/api/riego', rutasRiego);
app.use('/api/configuracion', rutasConfiguracion);
app.use('/api/expedientes', rutasExpedientes);

// Cualquier otra ruta de la API no existe
app.use('/api', (_req, _res) => {
  throw new ErrorHttp(404, 'Ruta no encontrada.');
});

// Manejador de errores: convierte cualquier error en una respuesta JSON en español
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ErrorHttp) {
    res.status(error.status).json({ error: error.message });
  } else if ((error as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  } else {
    console.error('[error]', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

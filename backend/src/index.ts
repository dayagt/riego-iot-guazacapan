// =====================================================================
// Punto de entrada del backend
// Levanta el servidor HTTP en el puerto configurado (por defecto 3000).
// =====================================================================
import { createServer } from 'node:http';
import { config } from './config';
import { app } from './app';

// Se crea el servidor HTTP aparte de Express porque en la fase 3
// Socket.IO se conecta a este mismo servidor.
const servidor = createServer(app);

servidor.listen(config.puerto, () => {
  console.log(`[servidor] API del Sistema de Riego IoT en http://localhost:${config.puerto}/api`);
});

-- =====================================================================
-- Esquema SistemaRiego (versión SQLite) — Prototipo RiegoIoT
-- ---------------------------------------------------------------------
-- Equivalente al script MySQL de la tesis (sección 5.2, págs. 78-83).
-- Este archivo lo ejecuta el backend automáticamente al arrancar
-- (backend/src/db.ts), por eso todas las sentencias usan IF NOT EXISTS.
--
-- Diferencias SOLO de sintaxis respecto a MySQL (no cambian el diseño):
--   * "INT AUTO_INCREMENT"  -> "INTEGER PRIMARY KEY AUTOINCREMENT"
--   * "ENUM(...)"           -> columna de texto con CHECK (... IN (...))
--   * Los nombres de índice en SQLite son únicos en toda la base, por eso
--     se les antepone el nombre de la tabla (ej. SensorHumedad_idMicro_idx).
--
-- Cambios de DISEÑO (marcados con "AGREGADO" y justificados en el README):
--   * Usuario.correo y Usuario.contrasenaHash  -> necesarios para el login.
--   * Configuracion.fechaHora                  -> saber cuándo se configuró.
--   * ActuadorBomba.modo                       -> distinguir riego AUTO/MANUAL.
--   * Tabla Expediente                         -> requerida por /expedientes.
-- =====================================================================

-- Activa la verificación de llaves foráneas (en SQLite viene apagada).
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Tabla Usuario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuario (
  idUsuario      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         VARCHAR(50),
  rol            VARCHAR(20),                 -- agricultor | tecnico | coordinador
  correo         VARCHAR(100) NOT NULL UNIQUE, -- AGREGADO: identificador para iniciar sesión
  contrasenaHash VARCHAR(100) NOT NULL         -- AGREGADO: contraseña cifrada con bcrypt
);

-- ---------------------------------------------------------------------
-- Tabla Microcontrolador
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Microcontrolador (
  idMicro       INTEGER PRIMARY KEY AUTOINCREMENT,
  Modelo        VARCHAR(50),
  estado        VARCHAR(8) CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  ip            VARCHAR(15),
  fechaRegistro DATETIME,
  idUsuario     INTEGER,
  CONSTRAINT idUsuario
    FOREIGN KEY (idUsuario) REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS Microcontrolador_idUsuario_idx ON Microcontrolador (idUsuario ASC);

-- ---------------------------------------------------------------------
-- Tabla SensorHumedad
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS SensorHumedad (
  idSensorHumedad INTEGER PRIMARY KEY AUTOINCREMENT,
  valorHumedad    FLOAT,
  fechaHora       DATETIME,
  idMicro         INTEGER,
  CONSTRAINT idMicro
    FOREIGN KEY (idMicro) REFERENCES Microcontrolador (idMicro)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS SensorHumedad_idMicro_idx ON SensorHumedad (idMicro ASC);

-- ---------------------------------------------------------------------
-- Tabla ActuadorBomba
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ActuadorBomba (
  idBomba   INTEGER PRIMARY KEY AUTOINCREMENT,
  estado    VARCHAR(3) CHECK (estado IN ('ON', 'OFF')),
  fechaHora DATETIME,
  idMicro   INTEGER,
  modo      VARCHAR(6) NOT NULL DEFAULT 'AUTO'
            CHECK (modo IN ('AUTO', 'MANUAL')),  -- AGREGADO: quién originó el cambio
  CONSTRAINT FK_Actuadorbomba_Micro
    FOREIGN KEY (idMicro) REFERENCES Microcontrolador (idMicro)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS ActuadorBomba_idMicro_idx ON ActuadorBomba (idMicro ASC);

-- ---------------------------------------------------------------------
-- Tabla Configuracion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Configuracion (
  idConfig      INTEGER PRIMARY KEY AUTOINCREMENT,
  umbralHumedad FLOAT,
  idUsuario     INTEGER,
  fechaHora     DATETIME,                      -- AGREGADO: cuándo se guardó el umbral
  CONSTRAINT FK_Config_Usuario
    FOREIGN KEY (idUsuario) REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS Configuracion_idUsuario_idx ON Configuracion (idUsuario ASC);

-- ---------------------------------------------------------------------
-- Tabla Expediente (AGREGADA)
-- Datos básicos de parcela/cultivo para el endpoint /expedientes
-- (tesis 2.1.4: "/expedientes para almacenar información de cultivos y usuarios").
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Expediente (
  idExpediente INTEGER PRIMARY KEY AUTOINCREMENT,
  parcela      VARCHAR(50),
  cultivo      VARCHAR(50),
  areaM2       FLOAT,
  ubicacion    VARCHAR(100),
  idUsuario    INTEGER,                        -- agricultor responsable de la parcela
  CONSTRAINT FK_Expediente_Usuario
    FOREIGN KEY (idUsuario) REFERENCES Usuario (idUsuario)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS Expediente_idUsuario_idx ON Expediente (idUsuario ASC);

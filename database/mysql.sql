-- =====================================================================
-- Esquema SistemaRiego (versión MySQL) — Prototipo RiegoIoT
-- ---------------------------------------------------------------------
-- Basado en el script de MySQL Workbench de la tesis (sección 5.2,
-- págs. 78-83). Se conservan tablas, columnas, tipos, índices y nombres
-- de restricciones originales.
--
-- El prototipo usa SQLite (database/sqlite.sql). Este archivo es el
-- equivalente para MySQL 8, por si se requiere montar la base en un
-- servidor MySQL.
--
-- Cambios respecto a la tesis (marcados con "AGREGADO"):
--   * Usuario.correo y Usuario.contrasenaHash  -> necesarios para el login (JWT).
--   * Configuracion.fechaHora                  -> saber cuándo se configuró el umbral.
--   * ActuadorBomba.modo                       -> distinguir riego AUTO / MANUAL.
--   * Tabla Expediente                         -> requerida por el endpoint /expedientes.
-- =====================================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE SCHEMA IF NOT EXISTS `SistemaRiego` DEFAULT CHARACTER SET utf8;
USE `SistemaRiego` ;

-- ---------------------------------------------------------------------
-- Table `SistemaRiego`.`Usuario`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SistemaRiego`.`Usuario` (
  `idUsuario` INT AUTO_INCREMENT,
  `nombre` VARCHAR(50),
  `rol` VARCHAR(20),
  `correo` VARCHAR(100) NOT NULL,          -- AGREGADO: identificador para iniciar sesión
  `contrasenaHash` VARCHAR(100) NOT NULL,  -- AGREGADO: contraseña cifrada con bcrypt
  PRIMARY KEY (`idUsuario`),
  UNIQUE INDEX `correo_UNIQUE` (`correo` ASC))
ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table `SistemaRiego`.`Microcontrolador`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SistemaRiego`.`Microcontrolador` (
  `idMicro` INT AUTO_INCREMENT,
  `Modelo` VARCHAR(50),
  `estado` ENUM('ACTIVO', 'INACTIVO'),
  `ip` VARCHAR(15),
  `fechaRegistro` DATETIME,
  `idUsuario` INT,
  PRIMARY KEY (`idMicro`),
  INDEX `idUsuario_idx` (`idUsuario` ASC),
  CONSTRAINT `idUsuario`
    FOREIGN KEY (`idUsuario`)
    REFERENCES `SistemaRiego`.`Usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table `SistemaRiego`.`SensorHumedad`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SistemaRiego`.`SensorHumedad` (
  `idSensorHumedad` INT AUTO_INCREMENT,
  `valorHumedad` FLOAT,
  `fechaHora` DATETIME,
  `idMicro` INT,
  PRIMARY KEY (`idSensorHumedad`),
  INDEX `idMicro_idx` (`idMicro` ASC),
  CONSTRAINT `idMicro`
    FOREIGN KEY (`idMicro`)
    REFERENCES `SistemaRiego`.`Microcontrolador` (`idMicro`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table `SistemaRiego`.`ActuadorBomba`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SistemaRiego`.`ActuadorBomba` (
  `idBomba` INT AUTO_INCREMENT,
  `estado` ENUM('ON', 'OFF'),
  `fechaHora` DATETIME,
  `idMicro` INT,
  `modo` ENUM('AUTO', 'MANUAL') NOT NULL DEFAULT 'AUTO',  -- AGREGADO
  PRIMARY KEY (`idBomba`),
  INDEX `idMicro_idx` (`idMicro` ASC),
  CONSTRAINT `FK_Actuadorbomba_Micro`
    FOREIGN KEY (`idMicro`)
    REFERENCES `SistemaRiego`.`Microcontrolador` (`idMicro`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table `SistemaRiego`.`Configuracion`
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SistemaRiego`.`Configuracion` (
  `idConfig` INT AUTO_INCREMENT,
  `umbralHumedad` FLOAT,
  `idUsuario` INT,
  `fechaHora` DATETIME,                    -- AGREGADO
  PRIMARY KEY (`idConfig`),
  INDEX `idUsuario_idx` (`idUsuario` ASC),
  CONSTRAINT `FK_Config_Usuario`
    FOREIGN KEY (`idUsuario`)
    REFERENCES `SistemaRiego`.`Usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Table `SistemaRiego`.`Expediente`  (AGREGADA)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SistemaRiego`.`Expediente` (
  `idExpediente` INT AUTO_INCREMENT,
  `parcela` VARCHAR(50),
  `cultivo` VARCHAR(50),
  `areaM2` FLOAT,
  `ubicacion` VARCHAR(100),
  `idUsuario` INT,
  PRIMARY KEY (`idExpediente`),
  INDEX `idUsuario_idx` (`idUsuario` ASC),
  CONSTRAINT `FK_Expediente_Usuario`
    FOREIGN KEY (`idUsuario`)
    REFERENCES `SistemaRiego`.`Usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

-- =====================================================================
-- Datos de prueba (los mismos que carga el prototipo en SQLite)
-- Contraseñas: agricultor123, tecnico123, coordinador123 (cifradas con bcrypt)
-- =====================================================================
INSERT INTO `SistemaRiego`.`Usuario` (`nombre`, `rol`, `correo`, `contrasenaHash`) VALUES
  ('Juan Pérez',  'agricultor',  'agricultor@riego.local',  '$2b$10$7S.6xQINIsYGMGdN1DAlwOjpslXhff9pVuWsGfb041pwzxviFkoUy'),
  ('Técnico IoT', 'tecnico',     'tecnico@riego.local',     '$2b$10$t0A740ut/ckeUJgWdTqwu.OurtWY458p..xf7cQykKZyHG1flKG0q'),
  ('Ana Morales', 'coordinador', 'coordinador@riego.local', '$2b$10$H8H.SM9TPtTWYI8u7wVNh.VJ/Ho4UdVrN3rb4fbuTvleCzBFPZ4km');

INSERT INTO `SistemaRiego`.`Microcontrolador` (`Modelo`, `estado`, `ip`, `fechaRegistro`, `idUsuario`) VALUES
  ('ESP32 DevKit V1', 'ACTIVO', '192.168.1.50', NOW(), 2);

INSERT INTO `SistemaRiego`.`Configuracion` (`umbralHumedad`, `idUsuario`, `fechaHora`) VALUES
  (35, 2, NOW());

INSERT INTO `SistemaRiego`.`ActuadorBomba` (`estado`, `fechaHora`, `idMicro`, `modo`) VALUES
  ('OFF', NOW(), 1, 'AUTO');

INSERT INTO `SistemaRiego`.`Expediente` (`parcela`, `cultivo`, `areaM2`, `ubicacion`, `idUsuario`) VALUES
  ('Parcela 1', 'Maíz', 2500, 'Guazacapán, Santa Rosa', 1);

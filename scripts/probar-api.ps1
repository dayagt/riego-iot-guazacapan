# =====================================================================
# Prueba automática de la API REST (fase 2)
# ---------------------------------------------------------------------
# Requisitos: el backend debe estar corriendo en otra terminal:
#     npm run db:reiniciar   (opcional: empezar con la base limpia)
#     npm run backend
# Ejecutar desde la carpeta RiegoIoT:
#     powershell -ExecutionPolicy Bypass -File scripts\probar-api.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api'

# Lee la clave del dispositivo desde el .env
$apiKey = ((Get-Content "$PSScriptRoot\..\.env" -Encoding UTF8) | Where-Object { $_ -match '^DISPOSITIVO_API_KEY=' }) -replace '^DISPOSITIVO_API_KEY=', ''

$script:ok = 0; $script:fallas = 0

# Hace una petición HTTP y devuelve el código de estado y la respuesta JSON
function Llamar($metodo, $ruta, $cuerpo = $null, $token = $null, $clave = $null) {
    $cabeceras = @{}
    if ($token) { $cabeceras['Authorization'] = "Bearer $token" }
    if ($clave) { $cabeceras['x-api-key'] = $clave }
    $parametros = @{ Method = $metodo; Uri = "$base$ruta"; Headers = $cabeceras; UseBasicParsing = $true }
    if ($null -ne $cuerpo) {
        $parametros['ContentType'] = 'application/json; charset=utf-8'
        $parametros['Body'] = [Text.Encoding]::UTF8.GetBytes(($cuerpo | ConvertTo-Json))
    }
    try {
        $r = Invoke-WebRequest @parametros
        $texto = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
        return @{ status = [int]$r.StatusCode; datos = $(if ($texto) { $texto | ConvertFrom-Json } else { $null }) }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if (-not $resp) { throw "No se pudo conectar con $base. ¿Está corriendo 'npm run backend'?" }
        $lector = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
        return @{ status = [int]$resp.StatusCode; datos = ($lector.ReadToEnd() | ConvertFrom-Json) }
    }
}

# Muestra [OK] o [FALLA] según la condición
function Comprobar($descripcion, $condicion, $detalle = '') {
    if ($condicion) { $script:ok++; Write-Host "  [OK]    $descripcion" -ForegroundColor Green }
    else { $script:fallas++; Write-Host "  [FALLA] $descripcion $detalle" -ForegroundColor Red }
}

function Lectura($valor) {
    $r = Llamar POST '/sensores' @{ idMicro = 1; valorHumedad = $valor } $null $apiKey
    Write-Host ("          humedad {0,3}% -> nivel {1,-8} bomba {2}" -f $valor, $r.datos.nivel, $r.datos.bomba)
    return $r
}

Write-Host "`n== 1. Autenticación (/api/auth)" -ForegroundColor Cyan
$agr = Llamar POST '/auth/login' @{ correo = 'agricultor@riego.local'; contrasena = 'agricultor123' }
$tec = Llamar POST '/auth/login' @{ correo = 'tecnico@riego.local'; contrasena = 'tecnico123' }
$coo = Llamar POST '/auth/login' @{ correo = 'coordinador@riego.local'; contrasena = 'coordinador123' }
Comprobar 'Login de los 3 roles' ($agr.status -eq 200 -and $tec.status -eq 200 -and $coo.status -eq 200)
$tAgr = $agr.datos.token; $tTec = $tec.datos.token; $tCoo = $coo.datos.token
$malo = Llamar POST '/auth/login' @{ correo = 'agricultor@riego.local'; contrasena = 'incorrecta' }
Comprobar 'Contraseña incorrecta -> 401' ($malo.status -eq 401) $malo.status
$sin = Llamar GET '/riego/estado'
Comprobar 'Consulta sin token -> 401' ($sin.status -eq 401) $sin.status

Write-Host "`n== 2. Configuración (/api/configuracion)" -ForegroundColor Cyan
$cfg = Llamar GET '/configuracion' $null $tAgr
Write-Host "          umbral vigente: $($cfg.datos.umbralHumedad)% (configurado por $($cfg.datos.configuradoPor))"
$r = Llamar PUT '/configuracion' @{ umbralHumedad = 40 } $tAgr
Comprobar 'Agricultor NO puede cambiar el umbral -> 403' ($r.status -eq 403) $r.status
$r = Llamar PUT '/configuracion' @{ umbralHumedad = 95 } $tTec
Comprobar 'Umbral fuera de rango -> 400' ($r.status -eq 400) $r.status
$r = Llamar PUT '/configuracion' @{ umbralHumedad = 35 } $tTec
Comprobar 'Técnico guarda umbral 35%' ($r.status -eq 200 -and $r.datos.configuradoPor -eq 'Técnico IoT') $r.status

Write-Host "`n== 3. Lecturas y control automático (/api/sensores)" -ForegroundColor Cyan
$r = Llamar POST '/sensores' @{ idMicro = 1; valorHumedad = 50 }
Comprobar 'Lectura sin clave de dispositivo -> 401' ($r.status -eq 401) $r.status
$r = Llamar POST '/sensores' @{ idMicro = 1; valorHumedad = 150 } $null $apiKey
Comprobar 'Humedad 150% (inválida) -> 400' ($r.status -eq 400) $r.status
$r = Lectura 50; Comprobar 'Humedad 50% (sobre el umbral) -> bomba OFF' ($r.datos.bomba -eq 'OFF')
$r = Lectura 30; Comprobar 'Humedad 30% (bajo el umbral) -> bomba ON automática, nivel CRITICO' ($r.datos.bomba -eq 'ON' -and $r.datos.nivel -eq 'CRITICO')
$r = Lectura 40; Comprobar 'Humedad 40% (entre umbral y umbral+margen) -> sigue ON' ($r.datos.bomba -eq 'ON')
$r = Lectura 46; Comprobar 'Humedad 46% (>= 35+10) -> bomba OFF automática' ($r.datos.bomba -eq 'OFF')

Write-Host "`n== 4. Control manual (/api/riego)" -ForegroundColor Cyan
$r = Llamar POST '/riego' @{ accion = 'ENCENDER' } $tAgr
Comprobar 'Acción inválida -> 400' ($r.status -eq 400) $r.status
$r = Llamar POST '/riego' @{ accion = 'ON' } $tAgr
Comprobar 'Agricultor enciende la bomba manualmente' ($r.status -eq 200 -and $r.datos.bomba.modo -eq 'MANUAL')
Write-Host "          $($r.datos.mensaje)"
$r = Lectura 70; Comprobar 'Humedad 70% pero la orden manual se respeta -> sigue ON' ($r.datos.bomba -eq 'ON')
$r = Llamar POST '/riego' @{ accion = 'OFF' } $tAgr
Comprobar 'Agricultor apaga la bomba manualmente' ($r.datos.bomba.estado -eq 'OFF')
$e = Llamar GET '/riego/estado' $null $tAgr
Comprobar 'Estado indica control manual vigente' ($null -ne $e.datos.controlManualHasta)
Write-Host "          bomba $($e.datos.bomba.estado) desde $($e.datos.bomba.fechaHora), manual hasta $($e.datos.controlManualHasta)"

Write-Host "`n== 5. Historial y resumen de agua" -ForegroundColor Cyan
$h = Llamar GET '/riego/historial?limite=5' $null $tAgr
Comprobar 'Historial de la bomba' ($h.status -eq 200 -and $h.datos.Count -gt 0)
$h.datos | Format-Table idBomba, estado, modo, fechaHora -AutoSize | Out-String | Write-Host
$s = Llamar GET '/riego/resumen' $null $tAgr
Comprobar 'Resumen de agua' ($s.status -eq 200)
Write-Host "          hoy: $($s.datos.hoy.minutosEncendida) min encendida, $($s.datos.hoy.litrosEstimados) L, $($s.datos.hoy.activaciones) activaciones ($($s.datos.hoy.activacionesAuto) auto / $($s.datos.hoy.activacionesManual) manual)"
$l = Llamar GET '/sensores?limite=5' $null $tAgr
Comprobar 'Últimas lecturas en orden cronológico' ($l.datos.Count -gt 0 -and $l.datos[-1].valorHumedad -eq 70)
$u = Llamar GET '/sensores/ultima' $null $tAgr
Comprobar 'Última lectura' ($u.datos.lectura.valorHumedad -eq 70 -and $u.datos.nivel -eq 'NORMAL')

Write-Host "`n== 6. Expedientes (/api/expedientes)" -ForegroundColor Cyan
$r = Llamar GET '/expedientes' $null $tAgr
Comprobar 'Agricultor ve sus parcelas' ($r.status -eq 200 -and @($r.datos).Count -ge 1)
$r = Llamar POST '/expedientes' @{ parcela = 'Parcela 2'; cultivo = 'Frijol'; idUsuario = 1 } $tAgr
Comprobar 'Agricultor NO puede crear expedientes -> 403' ($r.status -eq 403) $r.status
$r = Llamar POST '/expedientes' @{ parcela = 'Parcela 2'; cultivo = 'Frijol'; areaM2 = 1200; ubicacion = 'Guazacapán, Santa Rosa'; idUsuario = 1 } $tCoo
Comprobar 'Coordinador crea un expediente -> 201' ($r.status -eq 201) $r.status
$id = $r.datos.idExpediente
$r = Llamar PUT "/expedientes/$id" @{ parcela = 'Parcela 2'; cultivo = 'Ajonjolí'; areaM2 = 1200; idUsuario = 1 } $tCoo
Comprobar 'Coordinador modifica el expediente' ($r.status -eq 200 -and $r.datos.cultivo -eq 'Ajonjolí')
$r = Llamar DELETE "/expedientes/$id" $null $tCoo
Comprobar 'Coordinador elimina el expediente -> 204' ($r.status -eq 204) $r.status

Write-Host "`nResultado: $script:ok correctas, $script:fallas con falla`n" -ForegroundColor $(if ($script:fallas -eq 0) { 'Green' } else { 'Red' })

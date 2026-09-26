# hmc_app

Registro de movimientos, deudas y asistencia del club con Google Sheets

Este proyecto está dividido en un frontend web estándar (index.html, styles.css, app.js) y un backend serverless en Google Apps Script (code.gs).

📁 Estructura del Proyecto

├── index.html        # Vista principal e interfaz gráfica
├── styles.css        # Reglas CSS adicionales y personalizaciones
├── app.js            # Lógica frontend y sincronización API
├── code.gs           # Código backend para Google Apps Script
└── README.md         # Documentación e instrucciones

## Registro financiero unificado

La hoja `Registro` es la única fuente de movimientos financieros. Su formato es `ID | Fecha | Persona | Tipo | Monto | Concepto`. Los tipos son `gasto`, `reintegro`, `cuota_jueves` y `pago_cuota`. Los saldos por miembro y la cuota sugerida de Jueves Santo se calculan desde esas filas.

`Deudas` y `Movimientos` quedan intactas como fuentes históricas mientras se prepara una reconciliación por separado; la versión actual de la app no las lee ni les agrega registros. No publiques esta versión de Apps Script hasta estar listo para empezar a operar con `Registro`.

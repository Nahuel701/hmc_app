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

`Registro` ya está incorporada y es la única fuente financiera que lee y actualiza la app. Las pestañas `Deudas` y `Movimientos` se conservan como historial; no se leen ni se modifican.

## Publicación de Apps Script

Un push de este repositorio actualiza el frontend publicado desde GitHub Pages, pero no actualiza el Web App de Google Apps Script. Para activar la lectura y escritura de `Registro`, copia `code.gs` al proyecto de Apps Script y crea una nueva implementación del Web App. El frontend espera la respuesta con `schemaVersion: 2` y el arreglo `movements`.

En `Deudas y Reintegros`, el neto global suma los saldos netos por miembro y descuenta los pagos de cuotas de invitados que no tienen un cargo de cuota asociado. Esos pagos son créditos del club para cubrir reintegros. Un saldo positivo indica que el club debe; uno negativo, que deben los miembros.

Las pruebas se ejecutan con `node --test tests/*.test.cjs`.

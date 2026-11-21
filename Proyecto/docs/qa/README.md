# QA

Material de las pruebas de calidad que no son código: las pruebas de
usabilidad con usuarios piloto (KAN-165) y cómo se ejecutan. Las pruebas
automáticas viven con el código: los tests de cada paquete y la prueba
end-to-end del flujo de compra
([../desarrollo/postman/](../desarrollo/postman/README.md), KAN-164).

| Archivo | Qué es |
|---|---|
| [GUION-USABILIDAD.md](GUION-USABILIDAD.md) | Cómo se hace una sesión y las tareas para cada perfil: cliente (web y mobile), proveedor y administrador |
| [FORMULARIO-RETROALIMENTACION.md](FORMULARIO-RETROALIMENTACION.md) | Las preguntas que responde cada participante al terminar (para copiar a Google Forms o imprimir) |
| [PLANTILLA-INFORME-HALLAZGOS.md](PLANTILLA-INFORME-HALLAZGOS.md) | Plantilla del informe: métricas, hallazgos con severidad y mejoras priorizadas para el backlog |

## Orden de trabajo

1. Reclutar participantes (ver "Participantes" en el guion) y agendar
   sesiones de 40 minutos.
2. Preparar el ambiente: QA o local con el seed, cuentas de prueba y backend
   con `PASARELA=simulada` para que el pago no dependa de Transbank.
3. Correr cada sesión con el guion; anotar tiempos, errores y citas en la
   hoja de observación.
4. Al final, el participante responde el formulario.
5. Consolidar en el informe y crear en Jira un ticket por mejora (etiqueta
   `usabilidad`), priorizado con la tabla de severidad.

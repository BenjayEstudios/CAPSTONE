-- Datos de VOLUMEN para revisar planes de ejecucion de las consultas de
-- analitica (KAN-143, ver docs/CONSULTAS_ANALITICA.md). Correr SOLO sobre un
-- schema desechable con las migraciones y el seed aplicados, nunca sobre
-- cotizapp ni Aiven:
--
--   docker exec cotizapp-mysql mysql -uroot -pcotizapp -e "CREATE DATABASE cotizapp_volumen; GRANT ALL ON cotizapp_volumen.* TO 'cotizapp'@'%'"
--   DATABASE_URL=mysql://cotizapp:cotizapp@localhost:3306/cotizapp_volumen pnpm db:migrate
--   DATABASE_URL=mysql://cotizapp:cotizapp@localhost:3306/cotizapp_volumen pnpm db:seed
--   docker exec -i cotizapp-mysql mysql -ucotizapp -pcotizapp cotizapp_volumen < docs/volumen.sql
--   ... EXPLAIN ANALYZE ...
--   docker exec cotizapp-mysql mysql -uroot -pcotizapp -e "DROP DATABASE cotizapp_volumen"
--
-- Resultado: ~40 mil ordenes, 80 mil envios entre 30 proveedores nuevos,
-- 240 mil lineas y 800 mil eventos repartidos en 2026. Los montos no son
-- coherentes entre si: solo importa la distribucion para el optimizador.
SET SESSION cte_max_recursion_depth = 2000;
DROP TABLE IF EXISTS seq;
CREATE TABLE seq (n INT PRIMARY KEY);
INSERT INTO seq WITH RECURSIVE r(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM r WHERE n < 999) SELECT n FROM r;

-- 30 proveedores mas (100..129), con oferta para cada uno de los 17 productos.
INSERT INTO organizacion (id, tipo, razon_social, rut, estado, comision_pct)
SELECT 100+n, 'proveedor', CONCAT('Proveedor volumen ', n), CONCAT('9', LPAD(n,7,'0'), '-0'), 'activa', 8.00 FROM seq WHERE n < 30;
INSERT INTO oferta (producto_id, proveedor_id, precio_unitario, modalidad_entrega, estado)
SELECT p.n+1, 100+v.n, 1000 + (p.n*37 + v.n*11) % 20000, 'despacho', 'publicada'
FROM seq v JOIN seq p ON p.n < 17 WHERE v.n < 30 ORDER BY v.n, p.n;
SELECT MIN(id) INTO @of0 FROM oferta WHERE proveedor_id >= 100;

-- 40.000 ordenes durante 2026 (una cada ~11 min), 95% pagadas.
INSERT INTO orden (id, codigo, usuario_id, organizacion_id, direccion_entrega_id, subtotal, costo_despacho_total, comision_total, total, estado, estado_pago, creada_en)
SELECT 1000+k, CONCAT('V-', k), 8 + k%2, 6 + k%2, 6 + k%2, 100000, 5000, 8000, 105000, 'entregada', IF(k%20=0,'fallido','pagado'),
       TIMESTAMP('2026-01-01') + INTERVAL k*11 MINUTE
FROM (SELECT a.n*1000 + b.n AS k FROM seq a JOIN seq b WHERE a.n < 40) x;

-- 2 envios por orden repartidos entre los 30 proveedores nuevos.
INSERT INTO orden_envio (orden_id, proveedor_id, modalidad, direccion_entrega_id, subtotal, costo_despacho, comision_pct, comision_monto, estado)
SELECT o.id, 100 + (o.id*7 + e.n*13) % 30, 'despacho', 6, 50000, 2500, 8.00, 4000, IF(o.id%50=0,'cancelado','entregado')
FROM orden o JOIN seq e ON e.n < 2 WHERE o.id >= 1000;

-- 3 lineas por envio.
INSERT INTO orden_linea (orden_envio_id, oferta_id, producto_id, nombre_producto, precio_unitario, cantidad, total_linea)
SELECT oe.id, @of0 + (oe.proveedor_id-100)*17 + (oe.id + l.n*5) % 17, (oe.id + l.n*5) % 17 + 1, 'x', 5000, 1 + oe.id % 9, 5000
FROM orden_envio oe JOIN seq l ON l.n < 3 WHERE oe.orden_id >= 1000;

-- Particiones mensuales tambien para enero-agosto 2026.
ALTER TABLE evento_analitico REORGANIZE PARTITION p_anterior INTO (
  PARTITION p_anterior VALUES LESS THAN ('2026-01-01'),
  PARTITION p202601 VALUES LESS THAN ('2026-02-01'), PARTITION p202602 VALUES LESS THAN ('2026-03-01'),
  PARTITION p202603 VALUES LESS THAN ('2026-04-01'), PARTITION p202604 VALUES LESS THAN ('2026-05-01'),
  PARTITION p202605 VALUES LESS THAN ('2026-06-01'), PARTITION p202606 VALUES LESS THAN ('2026-07-01'),
  PARTITION p202607 VALUES LESS THAN ('2026-08-01'), PARTITION p202608 VALUES LESS THAN ('2026-09-01'));

-- 800.000 eventos durante 2026 (uno cada ~35 s): 60% vistas, 30% clicks, 10% busquedas.
INSERT INTO evento_analitico (tipo_evento, producto_id, oferta_id, sesion_id, origen, convirtio, termino, resultados, creado_en)
SELECT CASE WHEN k%10 < 6 THEN 'vista_producto' WHEN k%10 < 9 THEN 'click_oferta' ELSE 'busqueda' END,
       IF(k%10 < 9, (k*31) % 17 + 1, NULL),
       IF(k%10 BETWEEN 6 AND 8, @of0 + (k%30)*17 + (k*31) % 17, NULL),
       LPAD(k DIV 4, 36, '0'),
       IF(k%10 < 6, 'catalogo', NULL),
       IF(k%10 BETWEEN 6 AND 8, k%5 = 0, NULL),
       IF(k%10 = 9, ELT(1 + k%6, 'aceite','arroz','levadura','harina integral','queso','mantequilla'), NULL),
       IF(k%10 = 9, IF(k%6 IN (2,3,5), 0, 3), NULL),
       TIMESTAMP('2026-01-01') + INTERVAL k*35 SECOND
FROM (SELECT a.n*1000 + b.n AS k FROM seq a JOIN seq b WHERE a.n < 800) x;
DROP TABLE seq;
ANALYZE TABLE orden, orden_envio, orden_linea, oferta, evento_analitico;
SELECT (SELECT COUNT(*) FROM orden) ordenes, (SELECT COUNT(*) FROM orden_envio) envios, (SELECT COUNT(*) FROM orden_linea) lineas, (SELECT COUNT(*) FROM evento_analitico) eventos;

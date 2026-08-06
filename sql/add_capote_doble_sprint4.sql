-- Sprint 4: producto comercial Capote Doble
INSERT INTO productos (nombre, categoria, subcategoria, unidad, precio_kg, activo, orden)
SELECT 'Capote Doble', 'Cerdo', 'Corte', 'pieza', 0, true, 336
WHERE NOT EXISTS (
  SELECT 1 FROM productos WHERE nombre = 'Capote Doble'
);

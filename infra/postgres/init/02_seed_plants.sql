INSERT INTO plants (
    id,
    name,
    category,
    clearance_radius_m,
    structure_clearance_m,
    sunlight,
    water_need,
    liters_per_week,
    style_tags,
    color
) VALUES
    ('quillay', 'Quillay', 'tree', 2.50, 2.00, ARRAY['full_sun'], 'low', 60.00, ARRAY['native', 'mediterranean'], '#7ea16b'),
    ('jacaranda', 'Jacaranda', 'tree', 3.00, 2.50, ARRAY['full_sun'], 'medium', 85.00, ARRAY['lush', 'formal'], '#8b6dbf'),
    ('olive', 'Olive Tree', 'tree', 2.20, 1.80, ARRAY['full_sun'], 'low', 55.00, ARRAY['mediterranean', 'formal'], '#94a86f'),
    ('lavender', 'Lavender', 'flower', 0.60, 0.20, ARRAY['full_sun'], 'low', 8.00, ARRAY['mediterranean', 'formal'], '#b48ad6'),
    ('rosemary', 'Rosemary', 'shrub', 0.70, 0.30, ARRAY['full_sun', 'partial_shade'], 'low', 9.00, ARRAY['mediterranean', 'formal'], '#5b8c5a'),
    ('agapanthus', 'Agapanthus', 'flower', 0.70, 0.20, ARRAY['full_sun', 'partial_shade'], 'medium', 12.00, ARRAY['formal', 'lush'], '#7ca3d8'),
    ('coiron', 'Coiron', 'grass', 0.80, 0.20, ARRAY['full_sun'], 'low', 7.00, ARRAY['native', 'mediterranean'], '#c2b280'),
    ('hydrangea', 'Hydrangea', 'flower', 0.90, 0.40, ARRAY['partial_shade', 'shade'], 'high', 18.00, ARRAY['lush'], '#7fb5d6')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    clearance_radius_m = EXCLUDED.clearance_radius_m,
    structure_clearance_m = EXCLUDED.structure_clearance_m,
    sunlight = EXCLUDED.sunlight,
    water_need = EXCLUDED.water_need,
    liters_per_week = EXCLUDED.liters_per_week,
    style_tags = EXCLUDED.style_tags,
    color = EXCLUDED.color,
    updated_at = NOW();

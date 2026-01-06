# Guía de Pruebas - Sistema de Tracking

Esta guía te ayudará a verificar que el sistema de tracking funciona correctamente.

## Pre-requisitos

1. ✅ Migraciones SQL ejecutadas en Supabase
2. ✅ Variables de entorno configuradas
3. ✅ Servidor de desarrollo corriendo

## Paso 1: Verificar Configuración

### 1.1 Verificar Variables de Entorno

Crea o verifica tu archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mjnucrsfshnxoinoabjp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
NEXT_PUBLIC_ENABLE_TRACKING=true
```

### 1.2 Verificar que el Tracking está Habilitado

Abre la consola del navegador (F12) y verifica que no hay errores de configuración de Supabase.

## Paso 2: Pruebas Básicas de Tracking

### 2.1 Verificar Tracking Automático de Navegación

1. Abre la aplicación en el navegador
2. Navega entre diferentes páginas
3. Abre la consola del navegador (F12)
4. Deberías ver eventos siendo enviados (o silenciosamente en background)

**Verificar en Supabase:**

```sql
-- Ver eventos recientes
SELECT * FROM sr_page_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver sesiones activas
SELECT * FROM sr_user_sessions 
ORDER BY started_at DESC 
LIMIT 5;
```

### 2.2 Probar Tracking Manual de Clicks

Agrega un botón de prueba en cualquier página:

```tsx
import { useTracking } from '@/lib/tracking-context'

function TestButton() {
  const { trackClick } = useTracking()
  
  return (
    <button
      data-tracking-id="test-button"
      data-tracking-type="button"
      onClick={() => {
        trackClick('test-button', 'button', 'Botón de Prueba')
        alert('Evento trackeado!')
      }}
    >
      🧪 Probar Tracking
    </button>
  )
}
```

**Verificar en Supabase:**

```sql
SELECT * FROM sr_page_events 
WHERE event_name = 'element_click'
ORDER BY created_at DESC;
```

### 2.3 Probar Tracking de Errores

Abre la consola del navegador y ejecuta:

```javascript
// Simular un error
throw new Error('Error de prueba para tracking')
```

**Verificar en Supabase:**

```sql
SELECT * FROM sr_errors 
WHERE error_message LIKE '%prueba%'
ORDER BY created_at DESC;
```

## Paso 3: Probar Tracking de Skills

### 3.1 Ejecutar un Skill y Verificar Tracking

1. Inicia sesión en la aplicación
2. Selecciona cualquier skill (ej: "PDF → Excel")
3. Sube un archivo y ejecuta el skill
4. Espera a que complete

**Verificar en Supabase:**

```sql
-- Ver uso de skills recientes
SELECT 
  su.*,
  s.name as skill_name,
  ac.cost_usd,
  ac.provider,
  ac.model
FROM sr_skill_usage su
LEFT JOIN sr_skills s ON s.id = su.skill_id
LEFT JOIN sr_api_costs ac ON ac.usage_id = su.id
ORDER BY su.created_at DESC
LIMIT 10;
```

### 3.2 Verificar Cálculo de Costos

```sql
-- Ver costos calculados
SELECT 
  provider,
  model,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost,
  COUNT(*) as usage_count
FROM sr_api_costs
GROUP BY provider, model;
```

## Paso 4: Probar Dashboard de Analytics

### 4.1 Acceder al Dashboard

1. Asegúrate de tener rol de admin
2. Navega a `/analytics`
3. Deberías ver el dashboard con métricas

### 4.2 Verificar Endpoints de API

**Dashboard Metrics:**
```bash
curl http://localhost:3005/api/analytics/dashboard
```

**User Journey:**
```bash
# Reemplaza USER_ID con un ID real
curl "http://localhost:3005/api/analytics/user-journey?user_id=USER_ID"
```

**Costs:**
```bash
curl "http://localhost:3005/api/analytics/costs?period_days=30&group_by=day"
```

**Export:**
```bash
curl "http://localhost:3005/api/analytics/export?type=events&format=csv" -o events.csv
```

## Paso 5: Verificar Métricas de Rendimiento

### 5.1 Verificar Web Vitals

El `PerformanceMonitor` debería estar capturando automáticamente:

**Verificar en Supabase:**

```sql
SELECT 
  metric_name,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as count
FROM sr_performance_metrics
WHERE metric_type = 'page_load'
GROUP BY metric_name;
```

### 5.2 Verificar Latencia de API

Después de ejecutar algunos skills, verifica:

```sql
SELECT 
  metric_name,
  AVG(value) as avg_latency_ms,
  COUNT(*) as request_count
FROM sr_performance_metrics
WHERE metric_type = 'api_response'
GROUP BY metric_name;
```

## Paso 6: Pruebas de Integración Completa

### 6.1 Flujo Completo de Usuario

1. **Iniciar sesión** → Verifica que se crea una sesión
2. **Navegar por páginas** → Verifica eventos de navegación
3. **Ejecutar un skill** → Verifica tracking de uso y costos
4. **Ver dashboard** → Verifica que aparecen las métricas

**Script SQL para verificar todo:**

```sql
-- Resumen completo de actividad reciente
WITH recent_activity AS (
  SELECT 
    'Eventos' as tipo,
    COUNT(*) as cantidad,
    MAX(created_at) as ultimo
  FROM sr_page_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
  
  UNION ALL
  
  SELECT 
    'Sesiones' as tipo,
    COUNT(*) as cantidad,
    MAX(started_at) as ultimo
  FROM sr_user_sessions
  WHERE started_at > NOW() - INTERVAL '1 hour'
  
  UNION ALL
  
  SELECT 
    'Skills Usados' as tipo,
    COUNT(*) as cantidad,
    MAX(created_at) as ultimo
  FROM sr_skill_usage
  WHERE created_at > NOW() - INTERVAL '1 hour'
  
  UNION ALL
  
  SELECT 
    'Costos Registrados' as tipo,
    COUNT(*) as cantidad,
    MAX(created_at) as ultimo
  FROM sr_api_costs
  WHERE created_at > NOW() - INTERVAL '1 hour'
  
  UNION ALL
  
  SELECT 
    'Métricas Performance' as tipo,
    COUNT(*) as cantidad,
    MAX(created_at) as ultimo
  FROM sr_performance_metrics
  WHERE created_at > NOW() - INTERVAL '1 hour'
  
  UNION ALL
  
  SELECT 
    'Errores' as tipo,
    COUNT(*) as cantidad,
    MAX(created_at) as ultimo
  FROM sr_errors
  WHERE created_at > NOW() - INTERVAL '1 hour'
)
SELECT * FROM recent_activity
ORDER BY ultimo DESC;
```

## Paso 7: Verificar Vistas Materializadas

### 7.1 Refrescar Vistas

```sql
SELECT refresh_all_tracking_views();
```

### 7.2 Verificar Contenido de Vistas

```sql
-- Métricas diarias
SELECT * FROM v_daily_metrics ORDER BY date DESC LIMIT 7;

-- Resumen de usuarios
SELECT * FROM v_user_activity_summary LIMIT 10;

-- Estadísticas de skills
SELECT * FROM v_skill_usage_stats ORDER BY total_uses DESC;

-- Costos por modelo
SELECT * FROM v_api_costs_by_model ORDER BY total_cost DESC;

-- Resumen de errores
SELECT * FROM v_error_summary ORDER BY date DESC LIMIT 7;
```

## Paso 8: Pruebas de Rendimiento

### 8.1 Verificar Batching de Eventos

1. Abre la consola del navegador
2. Ejecuta múltiples eventos rápidamente
3. Verifica que se agrupan en batches (revisa Network tab)

### 8.2 Verificar que no hay Duplicados

```sql
-- Verificar eventos duplicados por sesión
SELECT 
  session_id,
  event_name,
  page_path,
  COUNT(*) as count
FROM sr_page_events
GROUP BY session_id, event_name, page_path, timestamp
HAVING COUNT(*) > 1;
```

## Paso 9: Pruebas de Seguridad (RLS)

### 9.1 Verificar que Usuarios Solo Ven Sus Propios Datos

1. Crea dos usuarios diferentes
2. Cada uno ejecuta acciones
3. Verifica que solo ven sus propios eventos

**Query para verificar:**

```sql
-- Esto debería retornar solo eventos del usuario autenticado
-- (ejecutar desde el cliente con autenticación)
SELECT COUNT(*) FROM sr_page_events;
```

### 9.2 Verificar Permisos de Admin

1. Inicia sesión como admin
2. Accede a `/analytics`
3. Deberías ver datos de todos los usuarios

## Checklist de Verificación

- [ ] Eventos de navegación se capturan automáticamente
- [ ] Clicks con `data-tracking-id` se registran
- [ ] Errores JavaScript se capturan
- [ ] Sesiones se crean y actualizan correctamente
- [ ] Skills ejecutados se trackean con costos
- [ ] Métricas de rendimiento se capturan
- [ ] Dashboard muestra datos correctamente
- [ ] Exportación CSV funciona
- [ ] RLS funciona (usuarios solo ven sus datos)
- [ ] Admins pueden ver todos los datos
- [ ] Vistas materializadas se refrescan correctamente

## Troubleshooting

### Los eventos no se están registrando

1. Verifica `NEXT_PUBLIC_ENABLE_TRACKING=true`
2. Revisa la consola del navegador por errores
3. Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurado
4. Revisa Network tab para ver requests a `/api/tracking/*`

### Los costos no se calculan

1. Verifica que `calculate_api_cost` existe en Supabase
2. Revisa que los tokens se pasen correctamente en `updateSkillUsage`
3. Verifica que el modelo esté en la función `calculate_api_cost`

### El dashboard no carga

1. Verifica que el usuario tenga rol `admin` o `super_admin`
2. Revisa las políticas RLS
3. Refresca las vistas materializadas: `SELECT refresh_all_tracking_views();`

### Errores de permisos

1. Verifica que las políticas RLS estén activas
2. Revisa que el usuario esté autenticado
3. Verifica que el `user_id` coincida con `auth.uid()`

## Scripts de Prueba Rápida

### Ver Todo el Tracking de un Usuario

```sql
-- Reemplaza USER_ID con el ID real
SELECT 
  'Eventos' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_page_events
WHERE user_id = 'USER_ID'

UNION ALL

SELECT 
  'Sesiones' as tipo,
  COUNT(*) as total,
  MAX(started_at) as ultimo
FROM sr_user_sessions
WHERE user_id = 'USER_ID'

UNION ALL

SELECT 
  'Skills' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_skill_usage
WHERE user_id = 'USER_ID'

UNION ALL

SELECT 
  'Costo Total' as tipo,
  SUM(cost_usd)::INTEGER as total,
  MAX(created_at) as ultimo
FROM sr_api_costs ac
JOIN sr_skill_usage su ON su.id = ac.usage_id
WHERE su.user_id = 'USER_ID';
```

### Limpiar Datos de Prueba (CUIDADO!)

```sql
-- Solo ejecutar en desarrollo
DELETE FROM sr_page_events WHERE event_name LIKE '%test%' OR event_name LIKE '%prueba%';
DELETE FROM sr_errors WHERE error_message LIKE '%prueba%' OR error_message LIKE '%test%';
```

## Próximos Pasos

Una vez que todo funcione:

1. Configura un cron job para refrescar vistas materializadas diariamente
2. Monitorea el dashboard regularmente
3. Revisa errores sin resolver periódicamente
4. Ajusta precios de API cuando cambien

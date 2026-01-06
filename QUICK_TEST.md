# 🧪 Prueba Rápida del Sistema de Tracking

## Método 1: Prueba Visual (Más Rápido)

### Paso 1: Iniciar el Servidor

```bash
cd skill-runner-app
npm run dev
```

### Paso 2: Abrir la Aplicación

1. Abre `http://localhost:3005` en tu navegador
2. Inicia sesión con tu cuenta
3. **Deberías ver un panel verde "🧪 Panel de Pruebas de Tracking"** en la parte superior

### Paso 3: Ejecutar Pruebas

En el panel de pruebas, haz clic en cada botón:

1. **🔍 Verificar Sesión** - Debería mostrar tu Session ID
2. **📄 Test Page View** - Envía un evento de vista de página
3. **🖱️ Test Click** - Envía un evento de click
4. **⚡ Test Custom Event** - Envía un evento personalizado
5. **⚠️ Test Error** - Envía un error de prueba
6. **📊 Test Performance** - Envía una métrica de rendimiento

### Paso 4: Verificar en Supabase

Ejecuta estas queries en Supabase SQL Editor:

```sql
-- Ver eventos recientes (últimos 5 minutos)
SELECT 
  event_name,
  event_type,
  page_path,
  created_at
FROM sr_page_events
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- Ver sesiones activas
SELECT 
  session_id,
  user_id,
  started_at,
  events_count,
  device_type
FROM sr_user_sessions
ORDER BY started_at DESC
LIMIT 5;

-- Ver errores de prueba
SELECT 
  error_type,
  error_message,
  page_path,
  created_at
FROM sr_errors
WHERE error_message LIKE '%prueba%' OR error_message LIKE '%test%'
ORDER BY created_at DESC;

-- Ver métricas de performance
SELECT 
  metric_name,
  value,
  unit,
  page_path,
  created_at
FROM sr_performance_metrics
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

## Método 2: Prueba con Navegación Real

### Paso 1: Navegar por la Aplicación

1. Inicia sesión
2. Haz clic en diferentes skills
3. Navega a diferentes páginas
4. Ejecuta un skill (ej: Validador de CP)

### Paso 2: Verificar Tracking Automático

```sql
-- Ver todos los eventos de tu sesión actual
SELECT 
  event_type,
  event_name,
  page_path,
  timestamp
FROM sr_page_events
WHERE session_id = (
  SELECT session_id 
  FROM sr_user_sessions 
  ORDER BY started_at DESC 
  LIMIT 1
)
ORDER BY timestamp ASC;
```

## Método 3: Prueba de Skills y Costos

### Paso 1: Ejecutar un Skill

1. Selecciona "PDF → Excel" o cualquier skill
2. Sube un archivo
3. Ejecuta el skill
4. Espera a que complete

### Paso 2: Verificar Tracking de Skill

```sql
-- Ver uso de skills recientes
SELECT 
  su.id,
  su.skill_id,
  su.status,
  su.execution_time_ms,
  su.cost_usd,
  su.api_provider,
  su.model_used,
  su.created_at,
  s.name as skill_name
FROM sr_skill_usage su
LEFT JOIN sr_skills s ON s.id = su.skill_id
ORDER BY su.created_at DESC
LIMIT 5;

-- Ver costos de API
SELECT 
  provider,
  model,
  input_tokens,
  output_tokens,
  total_tokens,
  cost_usd,
  created_at
FROM sr_api_costs
ORDER BY created_at DESC
LIMIT 5;
```

## Método 4: Verificar Dashboard

### Paso 1: Acceder al Dashboard

1. Asegúrate de tener rol de admin
2. Navega a `http://localhost:3005/analytics`
3. Deberías ver métricas y gráficos

### Paso 2: Verificar Endpoints

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Probar endpoint de dashboard
fetch('/api/analytics/dashboard')
  .then(r => r.json())
  .then(data => console.log('Dashboard data:', data))
  .catch(err => console.error('Error:', err))

// Probar endpoint de costos
fetch('/api/analytics/costs?period_days=7&group_by=day')
  .then(r => r.json())
  .then(data => console.log('Costs data:', data))
  .catch(err => console.error('Error:', err))
```

## Checklist de Verificación Rápida

- [ ] Panel de pruebas aparece en desarrollo
- [ ] Session ID se genera correctamente
- [ ] Eventos se envían sin errores en consola
- [ ] Eventos aparecen en `sr_page_events`
- [ ] Sesiones se crean en `sr_user_sessions`
- [ ] Errores se capturan en `sr_errors`
- [ ] Métricas se guardan en `sr_performance_metrics`
- [ ] Skills se trackean en `sr_skill_usage`
- [ ] Costos se calculan en `sr_api_costs`
- [ ] Dashboard carga correctamente
- [ ] Endpoints de API responden correctamente

## Solución de Problemas Rápida

### No aparece el panel de pruebas

- Verifica que estás en modo desarrollo (`NODE_ENV=development`)
- Recarga la página
- Verifica la consola por errores

### Los eventos no se guardan

1. Abre Network tab en DevTools (F12)
2. Busca requests a `/api/tracking/*`
3. Verifica que no hay errores 500
4. Revisa la consola por errores de Supabase

### Session ID es null

- Verifica que `NEXT_PUBLIC_ENABLE_TRACKING=true`
- Verifica que el TrackingProvider está en providers.tsx
- Recarga la página completamente

### Dashboard no carga

- Verifica que tienes rol de admin
- Revisa la consola por errores
- Verifica que las vistas materializadas existen

## Query de Verificación Completa

Ejecuta esto para ver un resumen completo:

```sql
SELECT 
  'Eventos' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_page_events
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Sesiones' as tipo,
  COUNT(*) as total,
  MAX(started_at) as ultimo
FROM sr_user_sessions
WHERE started_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Skills' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_skill_usage
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Costos' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_api_costs
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Métricas' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_performance_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Errores' as tipo,
  COUNT(*) as total,
  MAX(created_at) as ultimo
FROM sr_errors
WHERE created_at > NOW() - INTERVAL '1 hour';
```

Si todos los tipos muestran datos recientes, **¡el sistema está funcionando correctamente!** ✅

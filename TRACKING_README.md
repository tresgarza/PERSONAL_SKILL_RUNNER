# Sistema de Tracking y Analytics

Sistema completo de tracking de eventos de usuario, análisis de uso de skills, costos de API y métricas de rendimiento.

## Tabla de Contenidos

- [Características](#características)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [API Reference](#api-reference)
- [Dashboard de Analytics](#dashboard-de-analytics)
- [Estructura de Base de Datos](#estructura-de-base-de-datos)

## Características

- ✅ **Tracking de Eventos**: Captura automática de clicks, navegación, formularios, descargas
- ✅ **Sesiones de Usuario**: Seguimiento completo del journey del usuario
- ✅ **Costos de API**: Cálculo automático de costos por uso de skills (Anthropic, OpenAI)
- ✅ **Métricas de Rendimiento**: Web Vitals (LCP, FID, CLS, TTFB) y latencia de API
- ✅ **Manejo de Errores**: Captura y análisis de errores JavaScript y de API
- ✅ **Dashboard Completo**: Visualización de métricas, gráficos y exportación de datos
- ✅ **Seguridad**: Row Level Security (RLS) configurado en todas las tablas

## Instalación

### 1. Ejecutar Migraciones SQL

Ejecuta las migraciones en Supabase en este orden:

```sql
-- 1. Esquema de base de datos
\i supabase/migrations/001_tracking_schema.sql

-- 2. Funciones y vistas
\i supabase/migrations/002_tracking_functions.sql

-- 3. Políticas RLS
\i supabase/migrations/003_rls_policies.sql
```

O ejecuta cada archivo manualmente en el SQL Editor de Supabase.

### 2. Variables de Entorno

Agrega estas variables a tu `.env.local`:

```env
# Tracking (opcional, habilitado por defecto)
NEXT_PUBLIC_ENABLE_TRACKING=true
NEXT_PUBLIC_TRACKING_BATCH_SIZE=10
NEXT_PUBLIC_TRACKING_FLUSH_INTERVAL=5000

# Supabase Service Role (requerido para API routes)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Verificar Instalación

El sistema se activa automáticamente. Verifica que:

1. El `TrackingProvider` esté en `app/providers.tsx`
2. El `PerformanceMonitor` esté en `app/layout.tsx`
3. Las migraciones SQL se ejecutaron correctamente

## Configuración

### Habilitar/Deshabilitar Tracking

```env
NEXT_PUBLIC_ENABLE_TRACKING=false  # Deshabilitar tracking
```

### Configurar Precios de API

Edita `lib/api-pricing.ts` para actualizar precios cuando cambien:

```typescript
export const API_PRICING: Record<string, ProviderPricing> = {
  anthropic: {
    'claude-sonnet-4-20250514': {
      inputPricePer1K: 0.003,
      outputPricePer1K: 0.015,
    },
    // Agregar más modelos...
  },
}
```

## Uso

### Tracking Automático

El sistema captura automáticamente:

- **Navegación**: Cambios de página
- **Clicks**: En elementos con `data-tracking-id`
- **Errores**: Errores JavaScript y promesas rechazadas
- **Métricas**: Web Vitals y latencia de API

### Tracking Manual

```typescript
import { useTracking } from '@/lib/tracking-context'

function MyComponent() {
  const { trackEvent, trackClick, trackError } = useTracking()

  const handleButtonClick = () => {
    trackClick('button-submit', 'button', 'Submit Form')
    // Tu lógica...
  }

  const handleCustomEvent = () => {
    trackEvent({
      session_id: 'session_123',
      event_type: 'custom',
      event_name: 'feature_used',
      page_path: '/my-page',
      metadata: { feature: 'export', format: 'csv' },
    })
  }
}
```

### Tracking de Skills

El tracking de skills se integra automáticamente en `trackSkillUsage` y `updateSkillUsage`:

```typescript
import { trackSkillUsage, updateSkillUsage } from '@/lib/supabase'

// Al iniciar skill
const usage = await trackSkillUsage('pdf-to-excel', 'application/pdf', fileSize)

// Al completar skill
await updateSkillUsage(
  usage.id,
  'completed',
  executionTimeMs,
  undefined,
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
)
```

### Agregar Tracking a Elementos

Agrega atributos `data-tracking-*` a elementos HTML:

```html
<button 
  data-tracking-id="download-pdf"
  data-tracking-type="button"
>
  Descargar PDF
</button>
```

## API Reference

### Tracking Endpoints

#### `POST /api/tracking/event`

Registra eventos del frontend.

**Body:**
```json
{
  "events": [
    {
      "session_id": "session_123",
      "event_type": "click",
      "event_name": "button_click",
      "page_path": "/home",
      "element_id": "submit-btn",
      "metadata": {}
    }
  ]
}
```

#### `POST /api/tracking/session`

Crea una nueva sesión.

**Body:**
```json
{
  "session_id": "session_123",
  "device_type": "desktop",
  "browser": "Chrome",
  "os": "macOS",
  "screen_width": 1920,
  "screen_height": 1080
}
```

#### `POST /api/tracking/performance`

Registra métricas de rendimiento.

**Body:**
```json
{
  "page_path": "/home",
  "metric_type": "page_load",
  "metric_name": "lcp",
  "value": 1200,
  "unit": "ms"
}
```

#### `POST /api/tracking/error`

Registra errores.

**Body:**
```json
{
  "error_type": "javascript",
  "error_message": "Cannot read property 'x' of undefined",
  "error_stack": "Error: ...",
  "page_path": "/home"
}
```

### Analytics Endpoints

#### `GET /api/analytics/dashboard`

Obtiene métricas agregadas para el dashboard.

**Query Params:**
- `start_date` (opcional): Fecha inicio (ISO string)
- `end_date` (opcional): Fecha fin (ISO string)
- `user_id` (opcional): Filtrar por usuario
- `skill_id` (opcional): Filtrar por skill

**Response:**
```json
{
  "metrics": {
    "total_events": 1234,
    "active_sessions": 5,
    "total_skill_uses": 89,
    "total_api_cost": 12.34,
    "unresolved_errors": 3
  },
  "daily_metrics": [...],
  "skill_stats": [...],
  "cost_by_model": [...]
}
```

#### `GET /api/analytics/user-journey`

Obtiene el journey completo de un usuario.

**Query Params:**
- `user_id` (requerido): ID del usuario
- `start_date` (opcional): Fecha inicio
- `end_date` (opcional): Fecha fin
- `session_id` (opcional): Filtrar por sesión

#### `GET /api/analytics/costs`

Análisis de costos de API.

**Query Params:**
- `period_days` (opcional): Días a analizar (default: 30)
- `group_by` (opcional): 'day', 'week', 'month', 'provider', 'model'
- `user_id` (opcional): Filtrar por usuario
- `skill_id` (opcional): Filtrar por skill

#### `GET /api/analytics/export`

Exporta datos a CSV/JSON.

**Query Params:**
- `type` (requerido): 'events', 'sessions', 'costs', 'errors'
- `format` (opcional): 'csv' o 'json' (default: 'csv')
- `start_date` (opcional): Fecha inicio
- `end_date` (opcional): Fecha fin
- `user_id` (opcional): Filtrar por usuario

## Dashboard de Analytics

Accede al dashboard en `/analytics` (requiere rol de admin).

### Características del Dashboard

1. **Métricas Principales**
   - Total de eventos
   - Sesiones activas
   - Uso de skills
   - Costo total de API
   - Errores sin resolver

2. **Gráficos**
   - Uso de skills (barras)
   - Análisis de costos por modelo

3. **Tabla de Errores**
   - Lista de errores recientes
   - Estado de resolución
   - Filtros por tipo y fecha

4. **Exportación**
   - Exportar eventos, sesiones, costos o errores
   - Formato CSV compatible con Excel

### Filtros Disponibles

- **Rango de fechas**: Filtrar por período específico
- **Usuario**: Ver datos de un usuario específico (solo admins)
- **Skill**: Filtrar por skill específico

## Estructura de Base de Datos

### Tablas Principales

#### `sr_page_events`
Eventos granulares de la página (clicks, navegación, etc.)

#### `sr_user_sessions`
Sesiones de usuario con información de dispositivo y duración

#### `sr_api_costs`
Costos de API por cada uso de skill

#### `sr_performance_metrics`
Métricas de rendimiento (Web Vitals, latencia de API)

#### `sr_errors`
Errores y excepciones capturadas

### Vistas Materializadas

- `v_daily_metrics`: Métricas diarias agregadas
- `v_user_activity_summary`: Resumen de actividad por usuario
- `v_skill_usage_stats`: Estadísticas de uso de skills
- `v_api_costs_by_model`: Costos agrupados por modelo
- `v_error_summary`: Resumen de errores

### Funciones SQL

- `calculate_api_cost()`: Calcula costo basado en proveedor y modelo
- `get_user_journey()`: Retorna secuencia de eventos del usuario
- `get_skill_analytics()`: Métricas agregadas por skill
- `get_cost_summary()`: Resumen de costos agrupado

## Refrescar Vistas Materializadas

Las vistas materializadas deben refrescarse periódicamente:

```sql
SELECT refresh_all_tracking_views();
```

Configura un cron job en Supabase para ejecutar esto diariamente.

## Troubleshooting

### Los eventos no se están registrando

1. Verifica que `NEXT_PUBLIC_ENABLE_TRACKING` esté en `true`
2. Revisa la consola del navegador por errores
3. Verifica que las migraciones SQL se ejecutaron correctamente
4. Confirma que `SUPABASE_SERVICE_ROLE_KEY` esté configurado

### Los costos no se calculan

1. Verifica que `calculate_api_cost` esté disponible en Supabase
2. Revisa que los modelos estén en `lib/api-pricing.ts`
3. Confirma que `updateSkillUsage` reciba los tokens correctamente

### El dashboard no carga datos

1. Verifica que el usuario tenga rol de admin
2. Revisa las políticas RLS en Supabase
3. Confirma que las vistas materializadas existan
4. Refresca las vistas: `SELECT refresh_all_tracking_views();`

## Mejores Prácticas

1. **Privacidad**: No trackees información sensible (passwords, datos personales)
2. **Performance**: El sistema usa batching automático para optimizar requests
3. **Mantenimiento**: Actualiza precios de API cuando cambien
4. **Monitoreo**: Revisa errores regularmente en el dashboard
5. **Limpieza**: Considera archivar datos antiguos (>90 días) para mantener performance

## Soporte

Para problemas o preguntas:
1. Revisa los logs en Supabase
2. Verifica la consola del navegador
3. Consulta la documentación de Supabase RLS
4. Revisa los errores en `/analytics`

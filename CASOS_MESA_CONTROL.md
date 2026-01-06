# 🚨 Casos de Uso - Mesa de Control SOFOM

## Sistema de Validación de Direcciones con SEPOMEX

Este documento explica cómo la plataforma detecta y maneja discrepancias en direcciones para una mesa de control de crédito SOFOM.

---

## 📋 Casos donde NO cuadra con SEPOMEX

### 🔴 **CRÍTICO: CP No Existe**

**Escenario:**
```
Recibo dice: CP 99999, Colonia "San Juan"
SEPOMEX: CP 99999 NO EXISTE en México
```

**¿Qué significa?**
- Posible fraude (dirección inventada)
- Error grave de captura
- Documento falsificado

**Acción de la Plataforma:**
- ❌ **Estado: RECHAZADO**
- 🔴 **Alerta CRÍTICA**
- Coincidencia reducida a ≤30%
- **Recomendación:** Revisar manualmente, solicitar comprobante adicional, posible escalamiento a supervisor

---

### 🟠 **ALTO: CP Válido pero Colonia NO Coincide**

**Escenario:**
```
Recibo dice: CP 64720, Colonia "Centro"
SEPOMEX: CP 64720 tiene "Independencia", "Los Pinos", etc. pero NO "Centro"
```

**¿Qué significa?**
- Error de captura del proveedor de servicios
- Dirección antigua (la colonia cambió de nombre)
- Colonia informal/no registrada
- Posible fraude menor

**Acción de la Plataforma:**
- ⚠️ **Estado: REVISIÓN REQUERIDA**
- 🟠 **Alerta ALTA**
- Coincidencia reducida a ≤60%
- **Recomendación:** Verificar con cliente, solicitar aclaración, puede ser error menor pero requiere confirmación

---

### 🟡 **MEDIO: Municipio o Estado No Coincide**

**Escenario:**
```
Recibo dice: CP 64720, Municipio "San Pedro"
SEPOMEX: CP 64720 pertenece a "Monterrey"
```

**¿Qué significa?**
- Error administrativo menor
- Cambio de límites municipales
- Confusión entre municipio y ciudad

**Acción de la Plataforma:**
- ⚠️ **Estado: REVISIÓN REQUERIDA**
- 🟡 **Alerta MEDIA**
- Coincidencia reducida a ≤75%
- **Recomendación:** Revisar con datos oficiales de SEPOMEX, puede ser error menor

---

### 🔵 **BAJO: Coincidencia Baja con Google Maps**

**Escenario:**
```
Recibo dice: "Calle Oaxaca #1120, Col. Independencia"
Google Maps encuentra: "Oaxaca 1120, Independencia"
Coincidencia: 55% (diferencias menores de formato)
```

**¿Qué significa?**
- Diferencias de formato pero misma dirección
- Abreviaturas diferentes ("Col." vs sin prefijo)
- Misma ubicación física

**Acción de la Plataforma:**
- ✅ **Estado: APROBADO** (si SEPOMEX valida)
- 🔵 **Alerta BAJA**
- **Recomendación:** Revisar pero probablemente es válida

---

## 🎯 Flujo de Decisión para Mesa de Control

```
┌─────────────────────────────────────┐
│  Documento Subido                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  1. Extracción AI (Claude)          │
│     → Dirección estructurada        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Validación SEPOMEX              │
│     ✓ CP existe?                    │
│     ✓ Colonia coincide?             │
│     ✓ Municipio correcto?           │
│     ✓ Estado correcto?              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Verificación Google Maps        │
│     → Geocodificación               │
│     → Comparación de similitud      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Generación de Alertas           │
│     🔴 CRÍTICO: CP inválido         │
│     🟠 ALTO: Colonia no coincide    │
│     🟡 MEDIO: Municipio/Estado     │
│     🔵 BAJO: Diferencias menores    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. Decisión Automática             │
│     ✅ APROBADO                     │
│     ⚠️ REVISIÓN REQUERIDA           │
│     ❌ RECHAZADO                    │
└─────────────────────────────────────┘
```

---

## 📊 Matriz de Decisión

| CP Válido | Colonia Coincide | Google Maps | Estado |
|-----------|------------------|-------------|--------|
| ✅ | ✅ | ✅ | ✅ **APROBADO** |
| ✅ | ❌ | ✅ | ⚠️ **REVISIÓN REQUERIDA** |
| ✅ | ✅ | ❌ | ⚠️ **REVISIÓN REQUERIDA** |
| ❌ | - | - | ❌ **RECHAZADO** |
| ✅ | ❌ | ❌ | ⚠️ **REVISIÓN REQUERIDA** |

---

## 🔍 Ejemplos Reales

### Ejemplo 1: Dirección Válida ✅
```
Recibo: "Calle Oaxaca #1120, Col. Independencia, CP 64720, Monterrey, N.L."
SEPOMEX: ✅ CP 64720 válido, ✅ Colonia "Independencia" existe
Google Maps: ✅ Encuentra "Oaxaca 1120, Independencia, 64720 Monterrey"
Coincidencia: 95%
Estado: ✅ APROBADO
```

### Ejemplo 2: CP Inválido ❌
```
Recibo: "Calle Principal #100, Col. Centro, CP 99999, Ciudad"
SEPOMEX: ❌ CP 99999 NO EXISTE
Google Maps: ❌ No encuentra la dirección
Coincidencia: 25%
Estado: ❌ RECHAZADO
Alerta: 🔴 CRÍTICO - Posible fraude
```

### Ejemplo 3: Colonia Incorrecta ⚠️
```
Recibo: "Av. Reforma #500, Col. Centro, CP 64720, Monterrey"
SEPOMEX: ✅ CP 64720 válido, ❌ Colonia "Centro" NO existe en este CP
SEPOMEX sugiere: "Independencia", "Los Pinos", "Centro Histórico"
Google Maps: ✅ Encuentra dirección similar pero diferente colonia
Coincidencia: 60%
Estado: ⚠️ REVISIÓN REQUERIDA
Alerta: 🟠 ALTO - Verificar con cliente
```

---

## 💼 Beneficios para Mesa de Control SOFOM

1. **Detección Automática de Fraude**
   - Identifica CPs inválidos inmediatamente
   - Reduce falsos positivos con validación triple

2. **Ahorro de Tiempo**
   - Clasificación automática (Aprobado/Revisión/Rechazado)
   - Alertas priorizadas por nivel de riesgo

3. **Cumplimiento Regulatorio**
   - Validación contra fuente oficial (SEPOMEX)
   - Trazabilidad completa del proceso

4. **Reducción de Errores**
   - Elimina validación manual subjetiva
   - Datos oficiales siempre actualizados

5. **Escalamiento Inteligente**
   - Solo casos de riesgo requieren revisión humana
   - Casos aprobados pueden procesarse automáticamente

---

## 📈 Métricas Sugeridas

- **Tasa de Aprobación Automática:** % de casos aprobados sin revisión
- **Tasa de Detección de Fraude:** % de casos rechazados por CP inválido
- **Tiempo Promedio de Revisión:** Tiempo en casos de revisión requerida
- **Precisión del Sistema:** % de casos aprobados que resultan válidos

---

## 🔧 Configuración Recomendada

Para una SOFOM, se recomienda:

1. **Aprobación Automática:** Solo si:
   - CP válido ✅
   - Colonia coincide ✅
   - Google Maps encuentra dirección ✅
   - Coincidencia ≥85%

2. **Revisión Requerida:** Si:
   - CP válido pero colonia no coincide
   - Google Maps no encuentra dirección
   - Coincidencia entre 50-85%

3. **Rechazo Automático:** Si:
   - CP no existe en SEPOMEX
   - Coincidencia <30%

---

## 📞 Soporte

Para preguntas sobre el sistema de validación, contactar al equipo de desarrollo.

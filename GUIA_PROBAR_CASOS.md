# 🧪 Guía: Cómo Probar Diferentes Casos en la Interfaz

## 📍 Cómo Ver los Diferentes Resultados

### **Paso 1: Acceder a la Aplicación**
1. Abre `http://localhost:3002`
2. Ingresa el código de acceso: `FINCENTIVA2026`
3. Selecciona el skill **"🏠 Verificador de Direcciones"**

---

## 🎯 Casos de Prueba

### ✅ **CASO 1: Dirección Válida (APROBADO)**

**Para probar:**
- Sube un recibo de CFE, agua o luz de una dirección real y válida
- Ejemplo: Recibo de Monterrey con CP 64720, Colonia Independencia

**Lo que verás:**
```
✅ Estado: APROBADO (badge verde)
Coincidencia: 90-100%

📮 Validación SEPOMEX:
✅ CP válido según SEPOMEX
✅ Colonia coincide con CP
✅ Municipio correcto
✅ Estado correcto

🚨 Alertas de Riesgo:
(No hay alertas o solo alertas BAJAS)
```

---

### ⚠️ **CASO 2: Colonia Incorrecta (REVISIÓN REQUERIDA)**

**Para probar:**
- Crea un recibo de prueba (o edita uno) con:
  - CP válido (ej: 64720)
  - Colonia que NO existe en ese CP (ej: "Centro" cuando debería ser "Independencia")

**Lo que verás:**
```
⚠️ Estado: REVISIÓN REQUERIDA (badge amarillo)
Coincidencia: 50-70%

📮 Validación SEPOMEX:
✅ CP válido según SEPOMEX
❌ Colonia NO coincide con CP
✅ Municipio correcto
✅ Estado correcto

🚨 Alertas de Riesgo:
🟠 ALTO - Colonia no coincide
   Mensaje: "La colonia 'Centro' NO corresponde al CP 64720"
   Acción recomendada: Verificar con cliente

💡 Sugerencias SEPOMEX:
   Colonias válidas para CP 64720:
   - Independencia
   - Los Pinos
   - Centro Histórico
   ...
```

---

### ❌ **CASO 3: CP Inválido (RECHAZADO)**

**Para probar:**
- Crea un recibo de prueba con:
  - CP que NO existe (ej: 99999, 00000, 12345)
  - Cualquier colonia

**Lo que verás:**
```
❌ Estado: RECHAZADO (badge rojo)
Coincidencia: 20-30%

📮 Validación SEPOMEX:
❌ CP 99999 no encontrado en SEPOMEX

🚨 Alertas de Riesgo:
🔴 CRÍTICO - CP inválido
   Mensaje: "El código postal 99999 NO existe en el catálogo oficial"
   Acción recomendada: REVISAR MANUALMENTE - Posible fraude

Resumen Mesa de Control:
❌ Debe rechazarse - Revisar con supervisor
Total Alertas: 1
Críticas: 1
```

---

### ⚠️ **CASO 4: Google Maps No Encuentra (REVISIÓN REQUERIDA)**

**Para probar:**
- Sube un recibo con dirección muy ambigua o incompleta
- Ejemplo: Solo "Calle Principal" sin número ni colonia

**Lo que verás:**
```
⚠️ Estado: REVISIÓN REQUERIDA
Coincidencia: 40-60%

📮 Validación SEPOMEX:
✅ CP válido (si se proporcionó)
✅ Colonia coincide (si se proporcionó)

🚨 Alertas de Riesgo:
🟡 MEDIO - Google Maps no encontró
   Mensaje: "Google Maps no pudo geocodificar esta dirección"
   Acción recomendada: Revisar manualmente - Dirección incompleta
```

---

## 🔍 Cómo Interpretar los Resultados

### **Sección de Coincidencia**
```
Coincidencia: XX%
```
- **90-100%**: ✅ Dirección muy probablemente válida
- **70-89%**: ⚠️ Revisar diferencias menores
- **50-69%**: ⚠️ Requiere verificación
- **<50%**: ❌ Problemas significativos

### **Badge de Estado**
- 🟢 **APROBADO**: Puede procesarse automáticamente
- 🟡 **REVISIÓN REQUERIDA**: Necesita revisión humana
- 🔴 **RECHAZADO**: Debe rechazarse

### **Colores de Alertas**
- 🔴 **CRÍTICO**: Rojo - Acción inmediata requerida
- 🟠 **ALTO**: Naranja - Revisar pronto
- 🟡 **MEDIO**: Amarillo - Revisar cuando sea posible
- 🔵 **BAJO**: Azul - Informativo

---

## 📸 Ubicación de Cada Sección en la UI

```
┌─────────────────────────────────────────┐
│  ⚡ Skill Runner                        │
├─────────────────────────────────────────┤
│                                         │
│  🏠 Verificador de Direcciones         │
│  [Subir archivo]                        │
│  [Ejecutar Skill]                       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📄 Resultado                     │  │
│  ├───────────────────────────────────┤  │
│  │                                   │  │
│  │  📄 Dirección en Documento       │  │
│  │  →                                │  │
│  │  🗺️ Dirección Google Maps        │  │
│  │                                   │  │
│  │  Coincidencia: XX%               │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐ │  │
│  │  │ 📮 Validación SEPOMEX        │ │  │
│  │  │ ✅ CP válido                 │ │  │
│  │  │ ✅ Colonia coincide          │ │  │
│  │  └─────────────────────────────┘ │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐ │  │
│  │  │ 🚨 Alertas de Riesgo         │ │  │
│  │  │ [Estado Badge]                │ │  │
│  │  │                               │ │  │
│  │  │ Resumen:                      │ │  │
│  │  │ Total Alertas: X              │ │  │
│  │  │                               │ │  │
│  │  │ [Alertas individuales]         │ │  │
│  │  └─────────────────────────────┘ │  │
│  │                                   │  │
│  │  📍 Coordenadas: lat, lng         │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🧪 Casos de Prueba Rápidos

### **Test 1: Caso Perfecto**
```
Sube recibo real de Monterrey:
- CP: 64720
- Colonia: Independencia
- Calle: Oaxaca #1120

Resultado esperado: ✅ APROBADO, 95%+
```

### **Test 2: Colonia Incorrecta**
```
Edita mentalmente o usa recibo con:
- CP: 64720 (válido)
- Colonia: "Centro" (no existe en ese CP)

Resultado esperado: ⚠️ REVISIÓN REQUERIDA, 🟠 ALTO
```

### **Test 3: CP Falso**
```
Usa recibo con:
- CP: 99999 (no existe)
- Cualquier colonia

Resultado esperado: ❌ RECHAZADO, 🔴 CRÍTICO
```

---

## 💡 Tips para Ver Todos los Casos

1. **Usa recibos reales** para casos válidos
2. **Edita mentalmente** los datos al interpretar resultados
3. **Observa los colores** de las alertas
4. **Revisa las acciones recomendadas** en cada alerta
5. **Compara** los datos del documento vs SEPOMEX vs Google Maps

---

## 🎨 Elementos Visuales a Observar

### **Badges de Estado**
- Color verde = Aprobado
- Color amarillo = Revisión requerida  
- Color rojo = Rechazado

### **Alertas por Nivel**
- 🔴 Rojo = Crítico
- 🟠 Naranja = Alto
- 🟡 Amarillo = Medio
- 🔵 Azul = Bajo

### **Validaciones SEPOMEX**
- ✅ Verde = Válido
- ⚠️ Amarillo = Advertencia
- ❌ Rojo = Error

---

## 📊 Resumen de Estadísticas

En la sección "Resumen Mesa de Control" verás:
- **Total Alertas**: Número total de problemas detectados
- **Críticas**: Alertas críticas (requieren acción inmediata)
- **Altas**: Alertas altas (revisar pronto)
- **Estado Final**: Aprobado/Revisión/Rechazado

---

¿Necesitas ayuda con algún caso específico? ¡Pruébalo y observa los resultados!

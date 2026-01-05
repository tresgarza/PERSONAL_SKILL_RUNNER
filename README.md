# ⚡ Skill Runner

Una aplicación web simple para ejecutar Claude Skills de forma visual.

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
cd skill-runner-app
npm install
```

### 2. Configurar API Key

```bash
# Copia el archivo de ejemplo
cp .env.local.example .env.local

# Edita .env.local y agrega tu API key de Anthropic
# Obtén tu key en: https://console.anthropic.com/
```

### 3. Ejecutar

```bash
npm run dev
```

Abre http://localhost:3005 en tu navegador.

## 🎯 Skills Disponibles

| Skill | Descripción |
|-------|-------------|
| **PDF → Excel** | Extrae tablas de PDFs y genera Excel |
| **Organizador de Facturas** | Organiza facturas para impuestos |
| **Organizador de Archivos** | Sugiere cómo organizar tus archivos |
| **Generador de Changelog** | Crea notas de versión desde commits |
| **Analizador de Reuniones** | Extrae insights de transcripciones |
| **Escritor de Contenido** | Ayuda a crear contenido de calidad |

## 🔧 Agregar Nuevos Skills

1. Agrega el skill a `SKILLS` en `app/page.tsx`
2. Agrega la ruta al archivo SKILL.md en `SKILL_PATHS` en `app/api/execute-skill/route.ts`
3. Agrega un prompt personalizado en `SKILL_PROMPTS`

## 📝 Notas

- Requiere una API key de Anthropic (claude.ai)
- Los PDFs requieren procesamiento adicional para extracción de texto real
- El puerto por defecto es 3005 para evitar conflictos

## 💰 Costos

El uso de la API de Anthropic tiene costo por tokens. Consulta los precios en:
https://www.anthropic.com/pricing

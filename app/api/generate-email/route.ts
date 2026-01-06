import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface EmailGenerationRequest {
  contact: {
    name: string
    title: string
    email: string
    linkedinUrl?: string
  }
  company: {
    name: string
    industry: string
    employeeCount: number
    location: string
    domain: string
  }
  clientContext: {
    clientId: string
    clientName: string
    productDescription: string
    valueProposition: string
    painPoints: string[]
  }
  emailStyle: 'directo' | 'storytelling' | 'pregunta'
}

// Client configurations for email generation
const CLIENT_CONFIGS: Record<string, {
  name: string
  product: string
  valueProposition: string
  painPoints: string[]
  differentiator: string
}> = {
  fincentiva: {
    name: 'FINCENTIVA',
    product: 'Préstamos de nómina para empleados',
    valueProposition: 'Damos préstamos de nómina a los empleados de tu empresa sin que RH tenga que administrar nada. El empleado paga directo por descuento de nómina.',
    painPoints: [
      'Empleados pidiendo adelantos constantemente',
      'RH sin tiempo para administrar préstamos internos',
      'Alta rotación por problemas financieros',
      'Préstamos informales entre compañeros'
    ],
    differentiator: 'Sin carga administrativa para RH, aprobación en 24 horas, descuento automático de nómina'
  },
  tresgarza: {
    name: 'TRES GARZA',
    product: 'Distribución de productos de limpieza industrial',
    valueProposition: 'Entregamos productos de limpieza industrial en 24 horas. Nunca te quedas sin insumos.',
    painPoints: [
      'Proveedores que fallan en entregas',
      'Quedarse sin insumos de limpieza',
      'Tener que ir a comprar de emergencia',
      'Baños sucios = mala reputación'
    ],
    differentiator: 'Entrega garantizada en 24 horas, precios de mayoreo, asesoría en productos'
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      )
    }

    const body: EmailGenerationRequest = await request.json()
    const { contact, company, clientContext, emailStyle } = body

    // Get client config or use provided context
    const clientConfig = CLIENT_CONFIGS[clientContext.clientId] || {
      name: clientContext.clientName,
      product: clientContext.productDescription,
      valueProposition: clientContext.valueProposition,
      painPoints: clientContext.painPoints,
      differentiator: ''
    }

    const styleInstructions = {
      directo: 'Escribe un email corto y directo, enfocado en el beneficio principal. Máximo 80 palabras en el cuerpo.',
      storytelling: 'Usa una mini-historia o referencia a un cliente similar. Hazlo relatable. Máximo 100 palabras.',
      pregunta: 'Abre con una pregunta que genere reflexión sobre su situación actual. Máximo 80 palabras.'
    }

    const prompt = `Eres un experto en cold emails de ventas B2B en México. Genera UN email de ventas personalizado.

## DATOS DEL PROSPECTO
- Nombre: ${contact.name}
- Cargo: ${contact.title}
- Empresa: ${company.name}
- Industria: ${company.industry}
- Empleados: ${company.employeeCount}
- Ubicación: ${company.location}

## PRODUCTO/SERVICIO A VENDER
- Cliente: ${clientConfig.name}
- Producto: ${clientConfig.product}
- Propuesta de valor: ${clientConfig.valueProposition}
- Pain points típicos: ${clientConfig.painPoints.join(', ')}
- Diferenciador: ${clientConfig.differentiator}

## ESTILO REQUERIDO
${styleInstructions[emailStyle]}

## REGLAS ESTRICTAS
1. Subject line máximo 50 caracteres, personalizado
2. NO empieces con "Estimado", "Espero que se encuentre bien", o "Mi nombre es"
3. Abre con algo relevante para ELLOS, no sobre ti
4. UN solo beneficio principal
5. UN solo CTA claro (pregunta fácil de responder)
6. Tono profesional pero cercano (tuteo está bien en México)
7. Sin palabras spam ni exclamaciones excesivas
8. El email debe sonar natural, no generado por IA

## FORMATO DE RESPUESTA (JSON)
{
  "subject": "El asunto del email",
  "body": "El cuerpo completo del email incluyendo saludo y despedida",
  "cta": "La pregunta o llamada a acción específica",
  "tips": ["Tip 1 para follow-up", "Tip 2"]
}

Genera el email ahora:`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Anthropic API error:', error)
      return NextResponse.json(
        { error: 'Error generating email' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const content = data.content[0]?.text || ''
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not parse email response' },
        { status: 500 }
      )
    }

    const emailData = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      success: true,
      email: {
        subject: emailData.subject,
        body: emailData.body,
        cta: emailData.cta,
        tips: emailData.tips || []
      },
      contact: {
        name: contact.name,
        email: contact.email,
        company: company.name
      },
      style: emailStyle
    })

  } catch (error) {
    console.error('Email generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

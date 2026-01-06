/**
 * Configuración de precios de APIs
 * Actualizar estos valores cuando cambien los precios oficiales
 */

export interface PricingTier {
  inputPricePer1K: number
  outputPricePer1K: number
}

export interface ProviderPricing {
  [model: string]: PricingTier
}

export const API_PRICING: Record<string, ProviderPricing> = {
  anthropic: {
    'claude-3-5-sonnet-20241022': {
      inputPricePer1K: 0.003,
      outputPricePer1K: 0.015,
    },
    'claude-sonnet-4-20250514': {
      inputPricePer1K: 0.003,
      outputPricePer1K: 0.015,
    },
    'claude-3-opus-20240229': {
      inputPricePer1K: 0.015,
      outputPricePer1K: 0.075,
    },
    'claude-3-sonnet-20240229': {
      inputPricePer1K: 0.003,
      outputPricePer1K: 0.015,
    },
    'claude-3-haiku-20240307': {
      inputPricePer1K: 0.00025,
      outputPricePer1K: 0.00125,
    },
  },
  openai: {
    'gpt-4-turbo-preview': {
      inputPricePer1K: 0.01,
      outputPricePer1K: 0.03,
    },
    'gpt-4': {
      inputPricePer1K: 0.03,
      outputPricePer1K: 0.06,
    },
    'gpt-3.5-turbo': {
      inputPricePer1K: 0.0005,
      outputPricePer1K: 0.0015,
    },
  },
}

/**
 * Calcula el costo de una llamada a la API
 */
export function calculateApiCost(
  provider: 'anthropic' | 'openai' | 'google' | 'other',
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  if (provider === 'other' || !API_PRICING[provider]) {
    return 0
  }

  const providerPricing = API_PRICING[provider]
  const modelPricing = providerPricing[model] || providerPricing[Object.keys(providerPricing)[0]]

  if (!modelPricing) {
    return 0
  }

  const inputCost = (inputTokens / 1000) * modelPricing.inputPricePer1K
  const outputCost = (outputTokens / 1000) * modelPricing.outputPricePer1K

  return Math.round((inputCost + outputCost) * 1000000) / 1000000 // Redondear a 6 decimales
}

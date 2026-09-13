import { env } from '../../config/env';
import type { AIService } from './AIService';
import { mockAIProvider } from './MockAIProvider';

/**
 * Provider selection is the only place allowed to know about the `mock`
 * provider name — business logic depends only on the AIService interface
 * (see docs/DECISIONS.md ADR-006).
 */
export function getAIService(): AIService {
  switch (env.aiProvider) {
    case 'mock':
      return mockAIProvider;
    default:
      throw new Error(`Unknown AI_PROVIDER: ${env.aiProvider}`);
  }
}

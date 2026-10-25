import { BaseAIProvider } from './AIProvider';
import { AnalysisRequest, ConnectionStatus } from '../types/provider';
import { DebuggingReport } from '../types/analysis';
import { ReportValidator } from '../analysis/reportValidator';

export interface GeminiConfig {
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

export class GeminiProvider extends BaseAIProvider {
  public readonly id = 'gemini';
  public readonly displayName = 'Google Gemini API';

  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    super();
    this.config = {
      apiKey: config?.apiKey,
      model: config?.model || 'gemini-2.5-flash-lite',
      timeoutMs: config?.timeoutMs || 180000
    };
  }

  public updateConfig(config: Partial<GeminiConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  public setApiKey(apiKey?: string): void {
    this.config.apiKey = apiKey;
  }

  public async testConnection(): Promise<ConnectionStatus> {
    if (!this.config.apiKey || !this.config.apiKey.trim()) {
      return {
        success: false,
        provider: this.displayName,
        message: 'No Gemini API key configured. Use the "AI Error Checklister: Configure AI Provider" command to enter your API key.'
      };
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      // Lightweight test request
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Respond with valid JSON: {"status": "ok"}' }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timer));

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 400 || response.status === 403 || response.status === 401) {
          const body: any = await response.json().catch(() => ({}));
          const errMsg = body.error?.message || response.statusText;
          return {
            success: false,
            provider: this.displayName,
            latencyMs,
            message: `Authentication failed (HTTP ${response.status}): ${errMsg}. Verify your Gemini API key.`
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            provider: this.displayName,
            latencyMs,
            message: `Gemini quota/rate limit exceeded (HTTP 429). Please wait before trying again or check quota limits.`
          };
        }
        return {
          success: false,
          provider: this.displayName,
          latencyMs,
          message: `Gemini API returned error HTTP ${response.status}: ${response.statusText}`
        };
      }

      return {
        success: true,
        provider: this.displayName,
        availableModels: [this.config.model],
        latencyMs,
        message: `Successfully connected to Gemini API (${this.config.model}) in ${latencyMs}ms.`
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          provider: this.displayName,
          message: 'Connection to Gemini API timed out. Please check your internet connection.'
        };
      }
      return {
        success: false,
        provider: this.displayName,
        message: `Network error connecting to Gemini API: ${err.message}`
      };
    }
  }

  public async analyze(request: AnalysisRequest): Promise<DebuggingReport> {
    if (!this.config.apiKey || !this.config.apiKey.trim()) {
      throw new Error('Gemini API key is missing. Run "AI Error Checklister: Configure AI Provider" to save your key in secure storage.');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutTimer));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Gemini Authentication Failed (HTTP ${response.status}). Please verify your Gemini API key in settings.`);
        }
        if (response.status === 429) {
          throw new Error('Gemini API rate limit or quota exceeded (HTTP 429). Please wait before retrying.');
        }
        const errorText = await response.text();
        throw new Error(`Gemini API request failed (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const totalLines = request.context.fullSource.split(/\r?\n/).length;

      return ReportValidator.validate(content, {
        fileName: request.context.fileName,
        filePath: request.context.filePath,
        languageId: request.context.languageId,
        totalLines,
        detectedPurpose: request.context.detectedPurpose,
        staticIssues: request.context.staticIssues,
        diagnostics: request.context.diagnostics
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Gemini request timed out after ${Math.round(this.config.timeoutMs / 1000)} seconds.`);
      }
      throw err;
    }
  }
}

import { BaseAIProvider } from './AIProvider';
import { AnalysisRequest, ConnectionStatus } from '../types/provider';
import { DebuggingReport } from '../types/analysis';
import { ReportValidator } from '../analysis/reportValidator';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export class OllamaProvider extends BaseAIProvider {
  public readonly id = 'ollama';
  public readonly displayName = 'Ollama (Local AI)';

  private config: OllamaConfig;

  constructor(config?: Partial<OllamaConfig>) {
    super();
    this.config = {
      baseUrl: (config?.baseUrl || 'http://localhost:11434').replace(/\/+$/, ''),
      model: config?.model || 'qwen2.5-coder:7b',
      timeoutMs: config?.timeoutMs || 180000
    };
  }

  public updateConfig(config: Partial<OllamaConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      baseUrl: (config.baseUrl || this.config.baseUrl).replace(/\/+$/, '')
    };
  }

  public async testConnection(): Promise<ConnectionStatus> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      }).finally(() => clearTimeout(timer));

      if (!response.ok) {
        return {
          success: false,
          provider: this.displayName,
          message: `Ollama returned HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data: any = await response.json();
      const models: string[] = Array.isArray(data.models) 
        ? data.models.map((m: any) => m.name || m.model) 
        : [];

      const modelFound = models.some(m => m === this.config.model || m.startsWith(`${this.config.model}:`));

      const latencyMs = Date.now() - startTime;

      if (!modelFound && models.length > 0) {
        return {
          success: false,
          provider: this.displayName,
          availableModels: models,
          latencyMs,
          message: `Ollama is running, but configured model "${this.config.model}" is not installed. Available models: ${models.join(', ')}. Run: ollama pull ${this.config.model}`
        };
      }

      if (models.length === 0) {
        return {
          success: false,
          provider: this.displayName,
          availableModels: [],
          latencyMs,
          message: `Ollama is running at ${this.config.baseUrl}, but no models are downloaded yet. Run: ollama pull ${this.config.model}`
        };
      }

      return {
        success: true,
        provider: this.displayName,
        availableModels: models,
        latencyMs,
        message: `Connected successfully to Ollama at ${this.config.baseUrl}. Model "${this.config.model}" is ready (${latencyMs}ms).`
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          provider: this.displayName,
          message: `Connection to Ollama timed out at ${this.config.baseUrl}. Verify that the Ollama service is active.`
        };
      }
      return {
        success: false,
        provider: this.displayName,
        message: `Could not connect to Ollama at ${this.config.baseUrl} (${err.message || 'Connection refused'}). Make sure Ollama is running (e.g. run "ollama serve").`
      };
    }
  }

  public async analyze(request: AnalysisRequest): Promise<DebuggingReport> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1
          }
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutTimer));

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Model "${this.config.model}" not found in local Ollama. Run: ollama pull ${this.config.model}`);
        }
        const errorBody = await response.text();
        throw new Error(`Ollama request failed with status ${response.status}: ${errorBody}`);
      }

      const data: any = await response.json();
      const content = data.message?.content || '';

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
        throw new Error(`Ollama request timed out after ${Math.round(this.config.timeoutMs / 1000)} seconds. Consider increasing timeout in settings or switching to a lighter model.`);
      }
      if (err.message && err.message.includes('fetch failed')) {
        throw new Error(`Failed to communicate with Ollama at ${this.config.baseUrl}. Please verify Ollama is running with "ollama serve".`);
      }
      throw err;
    }
  }
}

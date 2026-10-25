import * as vscode from 'vscode';
import { AIProvider, ConnectionStatus } from '../types/provider';
import { OllamaProvider } from './OllamaProvider';
import { GeminiProvider } from './GeminiProvider';
import { MockProvider } from './MockProvider';

const GEMINI_SECRET_KEY = 'ai_error_checklister_gemini_api_key';

export class ProviderManager {
  private ollamaProvider: OllamaProvider;
  private geminiProvider: GeminiProvider;
  private mockProvider: MockProvider;
  private secretStorage: vscode.SecretStorage;

  constructor(secretStorage: vscode.SecretStorage) {
    this.secretStorage = secretStorage;
    this.ollamaProvider = new OllamaProvider({ model: 'qwen2.5-coder:7b' });
    this.geminiProvider = new GeminiProvider({ model: 'gemini-2.5-flash-lite' });
    this.mockProvider = new MockProvider();
  }

  public async initialize(): Promise<void> {
    await this.syncConfiguration();
  }

  public async syncConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration('aiErrorChecklister');

    const ollamaBaseUrl = config.get<string>('ollama.baseUrl', 'http://localhost:11434');
    const ollamaModel = config.get<string>('ollama.model', 'qwen2.5-coder:7b');
    const geminiModel = config.get<string>('gemini.model', 'gemini-2.5-flash-lite');
    const timeoutMs = config.get<number>('requestTimeoutMs', 180000);

    const apiKey = await this.secretStorage.get(GEMINI_SECRET_KEY);

    this.ollamaProvider.updateConfig({
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      timeoutMs
    });

    this.geminiProvider.updateConfig({
      apiKey,
      model: geminiModel,
      timeoutMs
    });
  }

  public getActiveProvider(): AIProvider {
    const config = vscode.workspace.getConfiguration('aiErrorChecklister');
    const providerType = config.get<string>('provider', 'gemini'); // Default to fast Gemini API!

    if (providerType === 'ollama') {
      return this.ollamaProvider;
    } else if (providerType === 'mock') {
      return this.mockProvider;
    }
    return this.geminiProvider;
  }

  public async toggleProvider(): Promise<string> {
    const config = vscode.workspace.getConfiguration('aiErrorChecklister');
    const current = config.get<string>('provider', 'gemini');
    const next = current === 'gemini' ? 'ollama' : 'gemini';

    await config.update('provider', next, vscode.ConfigurationTarget.Global);
    await this.syncConfiguration();
    return next;
  }

  public async setGeminiApiKey(key: string): Promise<void> {
    if (!key || !key.trim()) {
      await this.secretStorage.delete(GEMINI_SECRET_KEY);
      this.geminiProvider.setApiKey(undefined);
    } else {
      await this.secretStorage.store(GEMINI_SECRET_KEY, key.trim());
      this.geminiProvider.setApiKey(key.trim());
    }
  }

  public async clearGeminiApiKey(): Promise<void> {
    await this.secretStorage.delete(GEMINI_SECRET_KEY);
    this.geminiProvider.setApiKey(undefined);
  }

  public async testCurrentConnection(): Promise<ConnectionStatus> {
    await this.syncConfiguration();
    const provider = this.getActiveProvider();
    return provider.testConnection();
  }
}

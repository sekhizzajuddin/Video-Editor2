import { describe, it, expect } from 'vitest';
import { buildCatalogFromIds, classifyGroqModel } from './groqModelCatalog';

describe('classifyGroqModel', () => {
  it('detects vision models even as Groq renames them', () => {
    expect(classifyGroqModel('meta-llama/llama-4-scout-17b-16e-instruct')).toBe('vision');
    expect(classifyGroqModel('llama-3.2-11b-vision-preview')).toBe('vision');
    expect(classifyGroqModel('qwen/qwen3.6-27b')).toBe('vision');
  });

  it('detects reasoning models', () => {
    expect(classifyGroqModel('openai/gpt-oss-120b')).toBe('reasoning');
    expect(classifyGroqModel('llama-3.3-70b-versatile')).toBe('reasoning');
    expect(classifyGroqModel('qwen/qwen3-32b')).toBe('reasoning');
  });

  it('detects whisper and fast models', () => {
    expect(classifyGroqModel('whisper-large-v3-turbo')).toBe('whisper');
    expect(classifyGroqModel('llama-3.1-8b-instant')).toBe('fast');
  });
});

describe('buildCatalogFromIds', () => {
  it('picks the best reasoning + vision IDs from a live lineup', () => {
    const catalog = buildCatalogFromIds([
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'whisper-large-v3-turbo',
    ]);
    expect(catalog.reasoning).toBe('openai/gpt-oss-120b');
    expect(catalog.vision).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
    expect(catalog.fast).toBe('llama-3.1-8b-instant');
    expect(catalog.whisper).toBe('whisper-large-v3-turbo');
    expect(catalog.fingerprint.length).toBeGreaterThan(10);
  });

  it('falls back when a category is missing', () => {
    const catalog = buildCatalogFromIds(['llama-3.1-8b-instant']);
    expect(catalog.reasoning).toBeTruthy();
    expect(catalog.vision).toBeTruthy();
  });
});

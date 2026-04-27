import { supabase } from '@/lib/supabase';
import { UsageLimitError } from '@/lib/openai';

export async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri: audioUri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
  formData.append('model', 'whisper-1');

  const { data, error } = await supabase.functions.invoke('whisper-proxy', {
    body: formData,
  });

  if (error) {
    const errMsg = error.message ?? '';
    const errJson = JSON.stringify(error).slice(0, 300);

    if (errMsg.includes('429') || errJson.includes('USAGE_LIMIT')) {
      try {
        const parsed = JSON.parse(errJson);
        const ctx = parsed.context ?? parsed;
        if (ctx.error === 'USAGE_LIMIT') {
          throw new UsageLimitError(ctx.feature ?? 'voice_log', ctx.limit ?? 0, ctx.used ?? 0);
        }
      } catch (e) {
        if (e instanceof UsageLimitError) throw e;
      }
      throw new UsageLimitError('voice_log', 0, 0);
    }

    throw new Error(`Whisper proxy error: ${errMsg}`);
  }

  if (data && (data as { error?: string }).error === 'USAGE_LIMIT') {
    const d = data as { error: string; feature?: string; limit?: number; used?: number };
    throw new UsageLimitError(d.feature ?? 'voice_log', d.limit ?? 0, d.used ?? 0);
  }

  return (data as { text: string }).text;
}

import { supabase } from '@/lib/supabase';

export async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri: audioUri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
  formData.append('model', 'whisper-1');

  const { data, error } = await supabase.functions.invoke('whisper-proxy', {
    body: formData,
  });

  if (error) {
    throw new Error(`Whisper proxy error: ${error.message}`);
  }

  return (data as { text: string }).text;
}

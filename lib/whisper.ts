export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const formData = new FormData();
  formData.append('file', { uri: audioUri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
  formData.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.text as string;
}

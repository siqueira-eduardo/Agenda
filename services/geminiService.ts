
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Task, Goal, Profile } from "../types";

const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

export const generateSpeech = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Narração solene e motivadora: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore has a disciplined, firm tone
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBytes = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    return source;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

export const getAIResponse = async (
  prompt: string, 
  context: { tasks: Task[], goals: Goal[], activeProfile: Profile }
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    Você é o Assistente "Legado", um mentor de organização e disciplina familiar.
    Filosofia: "A ordem precede o sucesso."
    Perfil Ativo: ${context.activeProfile.name} (${context.activeProfile.role}, Nível ${context.activeProfile.level || 1}).
    Tarefas Pendentes: ${context.tasks.filter(t => !t.completed).length}
    Metas de Longo Prazo: ${context.goals.map(g => g.title).join(', ')}
    
    Sua missão é dar ordens claras, motivar com sobriedade e ajudar a manter o foco.
    Responda em português de forma concisa e autoritária, porém empática.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.6,
      },
    });

    return response.text || "A ordem não foi processada. Tente novamente.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro de conexão com o Mentor.";
  }
};

export const parseSmartTask = async (input: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extraia título, data (YYYY-MM-DD, hoje é ${new Date().toISOString().split('T')[0]}), pilar (Espiritual, Estudos, Trabalho, Saúde, Intelectual, Financeiro, Família) e prioridade (Alta, Média, Baixa) desta entrada: "${input}". Se urgente, prioridade Alta.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            pillar: { type: Type.STRING, enum: ['Espiritual', 'Estudos', 'Trabalho', 'Saúde', 'Intelectual', 'Financeiro', 'Família'] },
            priority: { type: Type.STRING, enum: ['Alta', 'Média', 'Baixa'] }
          },
          required: ["title", "date", "pillar", "priority"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Task Parsing Error:", e);
    return null;
  }
};

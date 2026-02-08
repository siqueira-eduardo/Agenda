
import { GoogleGenAI, Type } from "@google/genai";
import { Task, Goal, Profile } from "../types";

// Using process.env.API_KEY directly and initializing the client inside functions per guidelines.

export const getAIResponse = async (
  prompt: string, 
  context: { tasks: Task[], goals: Goal[], activeProfile: Profile }
) => {
  // Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    Você é o Assistente "Legado", um mentor de organização e disciplina familiar.
    Filosofia: "Uma vida organizada constrói um futuro sólido."
    Perfil Ativo: ${context.activeProfile.name} (${context.activeProfile.role}).
    Contexto do Usuário:
    Metas: ${JSON.stringify(context.goals)}
    Tarefas de hoje: ${JSON.stringify(context.tasks)}
    
    Ajude o usuário a manter a constância nos estudos, espiritualidade e metas de longo prazo.
    Seja sério, motivador e focado em ordem. Evite respostas infantis.
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

    // Use .text property instead of .text() method
    return response.text || "Não foi possível processar seu pedido no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro: Conexão com o cérebro da disciplina falhou.";
  }
};

export const parseSmartTask = async (input: string) => {
  // Always create a new GoogleGenAI instance right before making an API call.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extraia título, data (YYYY-MM-DD, hoje é ${new Date().toISOString().split('T')[0]}), e pilar (Espiritual, Estudos, Trabalho, Saúde, Intelectual, Financeiro, Família) desta entrada: "${input}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            pillar: { type: Type.STRING, enum: ['Espiritual', 'Estudos', 'Trabalho', 'Saúde', 'Intelectual', 'Financeiro', 'Família'] }
          },
          required: ["title", "date", "pillar"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini API Error (parseSmartTask):", e);
    return null;
  }
};

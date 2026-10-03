import { NextRequest, NextResponse } from 'next/server';
import { ARGUS_SYSTEM_PROMPT } from '@/lib/systemPrompt';
export const maxDuration = 60;

// Update to the latest Gemini 3 Flash endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent';

export async function POST(req: NextRequest) {
  try {
    const { messages, positionData } = await req.json();
    const systemPrompt = process.env.GEMINI_SYSTEM_PROMPT || '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Gemini API key' }, { status: 500 });
    }

    // Inject position data into system prompt
    const system = ARGUS_SYSTEM_PROMPT.replace(
      '[POSITION_DATA_PLACEHOLDER]', 
      JSON.stringify(positionData, null, 2)
    );
    
    const geminiPayload = {
      // 1. Move the system prompt here (NOT in contents)
      system_instruction: {
        parts: [{ text: system }]
      },
      // 2. Map 'assistant' role to 'model'
      contents: messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    };

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    const data = await res.json();

    // Check if the API returned an error (like safety filters or invalid keys)
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("Route Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
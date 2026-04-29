import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile } from "../types";

const FALLBACK_KEYS = [
  "AIzaSyC7wRQqYPR53dsnw10bO5ni_yig4Kw3i1E",
  "AIzaSyD3vHUdNLjiJCF2ex12Xl7q5eCf-oa_11w",
  "AIzaSyAFZxBABAexXCFVwsI0V3iE6mH57sFCUEk"
];

let currentKeyIndex = -1; // -1 means use the environment variable first

function getAIInstance() {
  let apiKey = process.env.GEMINI_API_KEY;
  
  if (currentKeyIndex >= 0 && currentKeyIndex < FALLBACK_KEYS.length) {
    apiKey = FALLBACK_KEYS[currentKeyIndex];
  } else if (currentKeyIndex >= FALLBACK_KEYS.length) {
    // Reset to start if we cycled through all
    currentKeyIndex = -1;
    apiKey = process.env.GEMINI_API_KEY;
  }

  if (!apiKey) {
    // If env var is missing, move to first fallback
    currentKeyIndex = 0;
    apiKey = FALLBACK_KEYS[0];
  }

  return new GoogleGenAI({ apiKey });
}

export async function generateCoffeeChatRecommendation(user1: UserProfile, user2: UserProfile): Promise<any> {
  const prompt = `
    Two professionals have just connected for networking. 
    Help them schedule a "matcha chat" by finding overlapping availability and suggesting a personalized invitation.

    User 1: ${user1.displayName} (${user1.role})
    Availability: ${JSON.stringify(user1.weeklyAvailability)}
    Interests: ${user1.interests?.join(', ')}
    Bio: ${user1.bio}

    User 2: ${user2.displayName} (${user2.role})
    Availability: ${JSON.stringify(user2.weeklyAvailability)}
    Interests: ${user2.interests?.join(', ')}
    Bio: ${user2.bio}

    Analyze their availability. If they have overlapping slots, pick the best one.
    If they have NO direct overlapping slots, suggest a time based on their general preferences or ask them to coordinate.

    Return a JSON object with:
    - suggestedTime: A clear string like "Wednesday during Lunch (12:00 - 13:00)"
    - recommendation: A friendly, professional message explaining WHY this is a good match and inviting them to meet for a matcha at that time.
  `;

  let attempts = 0;
  const maxAttempts = FALLBACK_KEYS.length + 1;

  while (attempts < maxAttempts) {
    try {
      const ai = getAIInstance();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedTime: { type: Type.STRING },
              recommendation: { type: Type.STRING }
            },
            required: ["suggestedTime", "recommendation"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No text returned from Gemini");
      return JSON.parse(text);
    } catch (error: any) {
      console.error(`Gemini Attempt ${attempts + 1} failed:`, error);
      
      // If it's an auth error, potentially quota or invalid key, try next key
      const isAuthError = error?.message?.includes('403') || error?.message?.includes('401') || error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('quota');
      
      if (isAuthError) {
        currentKeyIndex++;
        attempts++;
        continue;
      }

      // If not an auth error, or we ran out of keys
      break;
    }
  }

  // Final fallback if all attempts fail
  return {
    suggestedTime: "Coordinate via chat",
    recommendation: "You both have great backgrounds! Send a message to find a time that works for a quick discovery call or coffee."
  };
}

export async function generateIcebreaker(user1: UserProfile, user2: UserProfile): Promise<string> {
  const prompt = `
    Two professionals have just connected for networking on a platform for students and employers.
    Generate a single, short, engaging icebreaker question to help them start their first conversation.
    The question should be based on their shared interests, roles, or potential for collaboration.

    User 1: ${user1.displayName} (${user1.role})
    Interests: ${user1.interests?.join(', ')}
    Bio: ${user1.bio}

    User 2: ${user2.displayName} (${user2.role})
    Interests: ${user2.interests?.join(', ')}
    Bio: ${user2.bio}

    Return a JSON object with:
    - icebreaker: A single question (max 20 words).
  `;

  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            icebreaker: { type: Type.STRING }
          },
          required: ["icebreaker"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini");
    return JSON.parse(text).icebreaker;
  } catch (error: any) {
    console.error(`Icebreaker generation failed:`, error);
    // Generic fallbacks based on roles
    if (user1.role === 'employer' || user2.role === 'employer') {
      return "What specifically caught your eye about this connection's profile?";
    }
    return "What project are you most excited about working on right now?";
  }
}

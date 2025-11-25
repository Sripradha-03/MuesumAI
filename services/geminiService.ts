// services/geminiService.ts
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { INITIAL_ARTIFACTS, GEMINI_MODEL_FLASH, GEMINI_MODEL_PRO, GEMINI_MODEL_IMAGE } from '../constants';
import { GenerateContentPart, Artifact } from '../types';
import { decode, uuidv4 } from '../utils/helpers'; // Import uuidv4
import i18n from '../i18n'; // Import i18n instance

interface IdentifyImageResponse {
  paintingName: string; // This interface is no longer used for identifyImage
}

interface RecommendationResponse {
  recommendedArtifacts: {
    name: string;
    reason: string;
  }[];
}

interface ExtendedDescriptionResponse {
  extendedDescription: string;
}

// New interface for generated details for unidentified artifacts
interface GeneratedArtifactDetails {
  name: string;
  artist?: string;
  year?: string;
  description: string;
  category?: string;
  materials?: string[];
  dimensions?: string;
  museum?: string;
}

export const GEMINI_QUOTA_EXCEEDED_ERROR = 'GEMINI_QUOTA_EXCEEDED';


const getGeminiClient = (): GoogleGenAI => {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY is not defined in environment variables.');
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper function to check if an error is a GEMINI_QUOTA_EXCEEDED_ERROR
const isQuotaExceededError = (error: any): boolean => {
  // Check if error directly contains the code/status, or if it's nested under 'error'
  const errorDetails = error.error || error;
  return errorDetails && errorDetails.code === 429 && errorDetails.status === 'RESOURCE_EXHAUSTED';
};

/**
 * A utility function to call Gemini API with exponential backoff for quota errors.
 * @param apiCall The function that performs the actual Gemini API call.
 * @param retries Remaining number of retries.
 * @param delay Current delay before retrying.
 * @returns The result of the API call.
 * @throws {Error} If the API call fails after all retries or for non-quota errors.
 */
async function callGeminiWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  currentRetry: number = 0,
  baseDelayMs: number = 1000, // 1 second base delay
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    if (isQuotaExceededError(error) && currentRetry < maxRetries) {
      const retryDelay = baseDelayMs * Math.pow(2, currentRetry);
      console.warn(`Gemini API quota exceeded, retrying in ${retryDelay / 1000}s... (Attempt ${currentRetry + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return callGeminiWithRetry(apiCall, maxRetries, currentRetry + 1, baseDelayMs);
    } else if (isQuotaExceededError(error) && currentRetry >= maxRetries) {
      console.error(`Gemini API quota exceeded after ${maxRetries} retries.`, error);
      throw new Error(GEMINI_QUOTA_EXCEEDED_ERROR); // Throw a recognizable error for the UI
    } else {
      // For non-quota errors or if retries are exhausted, re-throw the original error
      throw error;
    }
  }
}


export const identifyImage = async (
  base64Image: string,
  mimeType: string,
  allArtifacts: Artifact[],
): Promise<Artifact | null> => { // Removed typeof GEMINI_QUOTA_EXCEEDED_ERROR from return type
  try {
    const ai = getGeminiClient();
    const currentLanguage = i18n.language;

    const imagePart: GenerateContentPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    };

    // --- Step 1: Try to identify against known artifacts ---
    // The `allArtifacts` array includes both initial data and any artifacts added by the admin.
    // The model is prompted to recognize the image against this comprehensive list.
    const artifactListForPrompt = allArtifacts.map(a => `- ID: "${a.id}", Name: "${a.name}"`).join('\n');
    const identificationPrompt = `Examine the provided image. Your task is to determine if the image depicts any of the following artworks from our curated collection.
Here is the list of known artworks with their IDs and names:
${artifactListForPrompt}

If you are confident that the image matches one of the listed artworks, respond with a JSON object containing a single key "artifactId" whose value is the exact ID of that artwork (e.g., {"artifactId": "mona-lisa"}).
If you cannot confidently identify the artwork from the provided list, or if the image is not an artwork, respond with a JSON object: {"artifactId": "UNKNOWN_ARTIFACT"}.
DO NOT include any conversational phrases, explanations, or additional formatting outside the JSON object.`;

    const identificationResponse = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: GEMINI_MODEL_FLASH, // Use GEMINI_MODEL_FLASH for JSON mode support
        contents: { parts: [imagePart, { text: identificationPrompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              artifactId: {
                type: Type.STRING,
                description: 'The ID of the identified artwork, or "UNKNOWN_ARTIFACT" if not found.',
              },
            },
            required: ['artifactId'],
          },
        },
      });
    });


    const identificationJsonStr = identificationResponse.text.trim();
    console.log('Gemini raw identification JSON response (identifyImage - known):', identificationJsonStr);

    let parsedIdentificationResponse: { artifactId: string };
    try {
      // Clean possible markdown code block from response if Gemini adds it
      const cleanedJsonStr = identificationJsonStr.startsWith('```json')
        ? identificationJsonStr.substring(identificationJsonStr.indexOf('\n') + 1, identificationJsonStr.lastIndexOf('```'))
        : identificationJsonStr;
      parsedIdentificationResponse = JSON.parse(cleanedJsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON identification response:', parseError, 'Raw response:', identificationJsonStr);
      // Fallback to general description if identification JSON is malformed
      return await getGeneralArtifactDetailsFromImage(base64Image, mimeType, currentLanguage);
    }

    const identifiedArtifactId = parsedIdentificationResponse.artifactId;

    if (identifiedArtifactId && identifiedArtifactId.toLowerCase() !== 'unknown_artifact') {
      const identifiedArtifact = allArtifacts.find(a => a.id.toLowerCase() === identifiedArtifactId.toLowerCase());
      if (identifiedArtifact) {
        return identifiedArtifact; // Found a known artifact (including admin-added ones)
      } else {
        console.warn(`Gemini returned artifact ID "${identifiedArtifactId}" but no matching artifact found in local database. Attempting general description.`);
        // Fall through to general description if ID is provided but doesn't match local DB
      }
    }

    // --- Step 2: If not found in known artifacts, get a general description ---
    return await getGeneralArtifactDetailsFromImage(base64Image, mimeType, currentLanguage);

  } catch (error: any) {
    if (error.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
      throw error; // Re-throw the specific quota error
    }
    console.error('Error in identifyImage service:', error);
    throw error; // Propagate other errors
  }
};

// New helper function to get a general description for any image
const getGeneralArtifactDetailsFromImage = async (
  base64Image: string,
  mimeType: string,
  language: string,
): Promise<Artifact | null> => { // Removed typeof GEMINI_QUOTA_EXCEEDED_ERROR from return type
  try {
    const ai = getGeminiClient();

    const imagePart: GenerateContentPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    };

    const generalDescriptionPrompt = `Examine this image and describe the main art piece or artifact shown.
    Provide its name, artist (if known, otherwise suggest origin/culture or "${i18n.t('unknown_artist')}"), estimated year/period (if discernible, otherwise "${i18n.t('unknown_year')}"), and a brief description (around 100-150 words). Also, if possible, suggest a "category" (e.g., painting, sculpture, pottery).
    Respond in JSON format, using ${language} language for text fields.
    Example:
    {
      "name": "The Title of the Artwork",
      "artist": "Artist's Name or Origin",
      "year": "Year or Period",
      "description": "A concise description of the artwork...",
      "category": "Painting"
    }
    If the image does not clearly show an art piece or artifact, or if you cannot describe it, respond with: {"name": "Unidentifiable Object"}.
    DO NOT include any conversational phrases or markdown outside the JSON object.`;

    const descriptionResponse = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: GEMINI_MODEL_FLASH, // Use GEMINI_MODEL_FLASH for visual understanding and JSON support
        contents: { parts: [imagePart, { text: generalDescriptionPrompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'The name of the artwork or "Unidentifiable Object".' },
              artist: { type: Type.STRING, description: 'Artist name or origin, e.g., "Leonardo da Vinci", "Ancient Egyptian", "Unknown Artist".' },
              year: { type: Type.STRING, description: 'Year or period, e.g., "1503-1519", "c. 1345 BC", "Unknown Year".' },
              description: { type: Type.STRING, description: 'A brief description of the artwork.' },
              category: { type: Type.STRING, description: 'Category, e.g., "Painting", "Sculpture", "Textile".' },
              materials: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'List of materials, e.g., ["Oil on canvas"].' },
              dimensions: { type: Type.STRING, description: 'Dimensions, e.g., "77 cm x 53 cm".' },
              museum: { type: Type.STRING, description: 'Current museum or location, e.g., "Louvre Museum".' },
            },
            required: ['name', 'description'], // name and description are always required
          },
        },
      });
    });


    const descriptionJsonStr = descriptionResponse.text.trim();
    console.log('Gemini raw description JSON response (identifyImage - general):', descriptionJsonStr);

    let parsedDescriptionResponse: GeneratedArtifactDetails;
    try {
      const cleanedJsonStr = descriptionJsonStr.startsWith('```json')
        ? descriptionJsonStr.substring(descriptionJsonStr.indexOf('\n') + 1, descriptionJsonStr.lastIndexOf('```'))
        : descriptionJsonStr;
      parsedDescriptionResponse = JSON.parse(cleanedJsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON general description response:', parseError, 'Raw response:', descriptionJsonStr);
      throw parseError; // Throw parsing errors
    }

    if (!parsedDescriptionResponse.name || parsedDescriptionResponse.name.toLowerCase() === 'unidentifiable object') {
      return null; // This case is a successful API call but unidentifiable content
    }

    // Create a new temporary Artifact object
    const newArtifact: Artifact = {
      id: uuidv4(), // Use a robust UUID for new artifacts
      name: parsedDescriptionResponse.name,
      artist: parsedDescriptionResponse.artist || i18n.t('unknown_artist'),
      year: parsedDescriptionResponse.year || i18n.t('unknown_year'),
      initialDescription: parsedDescriptionResponse.description,
      imageUrl: `data:${mimeType};base64,${base64Image}`, // Use the scanned image as the display image
      location: { lat: 0, lng: 0, city: i18n.t('unknown_location'), country: '' }, // Placeholder location
      category: parsedDescriptionResponse.category || i18n.t('unknown_category'),
      materials: parsedDescriptionResponse.materials || [i18n.t('various_materials')],
      dimensions: parsedDescriptionResponse.dimensions || i18n.t('not_specified'),
      museum: parsedDescriptionResponse.museum || i18n.t('not_applicable'),
      videoUrl: undefined,
      audioUrl: undefined,
    };

    return newArtifact;

  } catch (error: any) {
    if (error.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
      throw error; // Re-throw the specific quota error
    }
    console.error('Error generating general artifact details with Gemini:', error);
    throw error; // Propagate other errors
  }
};

export const getAiInsight = async (
  artifactName: string,
  initialDescription: string,
): Promise<string | null> => {
  try {
    const ai = getGeminiClient();
    const currentLanguage = i18n.language; // Get current language

    const prompt = `Your response MUST be in ${currentLanguage} language. Provide a more detailed and engaging description of the artwork "${artifactName}". Expand on its historical context, artistic significance, and interesting facts, building upon this initial description: "${initialDescription}". Limit the response to ~200-300 words. Respond in markdown format.`;

    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: GEMINI_MODEL_PRO,
        contents: { parts: [{ text: prompt }] },
        config: {
          thinkingConfig: { thinkingBudget: 128 },
        },
      });
    });


    const jsonStr = response.text.trim();

    return jsonStr || null;

  } catch (error: any) { // Catch error here to properly handle potential quota issues for insight
    if (error.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
      throw error; // Re-throw a recognizable error
    }
    console.error('Error fetching AI insight:', error);
    throw error; // Propagate other errors
  }
};

export const getAiRecommendations = async (
  currentArtifact: Artifact,
  allArtifacts: Artifact[],
): Promise<Artifact[] | null> => { // Removed typeof GEMINI_QUOTA_EXCEEDED_ERROR from return type
  try {
    const ai = getGeminiClient();
    const currentLanguage = i18n.language; // Get current language

    const allArtifactNames = allArtifacts.map(a => `"${a.name}" (Category: ${a.category}, Artist: ${a.artist})`).join('; ');
    const prompt = `Given the artwork "${currentArtifact.name}" (Category: ${currentArtifact.category}, Artist: ${currentArtifact.artist}, Year: ${currentArtifact.year}), suggest 3 other similar artworks from the following list that a visitor might enjoy. Focus on similarity in style, period, category, or artist.
    The list of available artworks is: ${allArtifactNames}.
    Respond with a JSON array of objects, each with a "name" (the artwork name from the list) and a "reason" (why it's recommended), for example:
    {"recommendedArtifacts": [
      {"name": "Artwork Name 1", "reason": "Reason for recommendation"},
      {"name": "Artwork Name 2", "reason": "Reason for recommendation"},
      {"name": "Artwork Name 3", "reason": "Reason for recommendation"}
    ]}.
    Do not recommend the artwork "${currentArtifact.name}" itself. Ensure the "reason" field is in ${currentLanguage} language.`;

    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: GEMINI_MODEL_FLASH,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedArtifacts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['name', 'reason'],
                },
              },
            },
            required: ['recommendedArtifacts'],
          },
        },
      });
    });


    const jsonStr = response.text.trim();
    const cleanedJsonStr = jsonStr.startsWith('```json')
      ? jsonStr.substring(jsonStr.indexOf('\n') + 1, jsonStr.lastIndexOf('```'))
      : jsonStr;
    const parsedResponse: RecommendationResponse = JSON.parse(cleanedJsonStr);

    const recommendedArtifacts = parsedResponse.recommendedArtifacts
      .map(rec => allArtifacts.find(a => a.name === rec.name))
      .filter((a): a is Artifact => a !== undefined && a.id !== currentArtifact.id);

    return recommendedArtifacts.slice(0, 3);
  } catch (error: any) {
    if (error.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
      throw error; // Throw as an error
    }
    console.error('Error getting AI recommendations:', error);
    throw error; // Propagate other errors
  }
};

export const generateSpeech = async (text: string): Promise<Uint8Array | null> => {
  try {
    const ai = getGeminiClient();
    // The voiceName 'Zephyr' is general-purpose. For true multi-language support,
    // you might select voices based on i18n.language if specific options are available
    // in the Gemini TTS API for different languages. For now, Zephyr will speak the provided text.
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });
    });


    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return decode(base64Audio);
    }
    return null;
  } catch (error: any) { // Explicitly type error to access message
    if (error.message === GEMINI_QUOTA_EXCEEDED_ERROR) {
      throw error; // Throw as an error
    }
    console.error('Error generating speech with Gemini:', error);
    throw error; // Propagate other errors
  }
};
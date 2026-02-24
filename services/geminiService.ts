import { GoogleGenAI, Type } from "@google/genai";
import { Platform, Tone, GeneratedPost } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Step 1: Extract a searchable product keyword
 */
export const extractSearchKeyword = async (userInput: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        User Input: "${userInput}"
        Task: Identify the single best product search keyword for an online bookstore (Eslite).
        Output: ONLY the keyword in Traditional Chinese.
      `,
    });
    return response.text?.trim() || userInput;
  } catch (e) {
    console.error("Keyword extraction failed", e);
    return userInput;
  }
};

/**
 * Step 2: Search Eslite via Backend API
 * Returns a list of products
 */
export const searchEsliteProducts = async (keyword: string): Promise<any[]> => {
  console.log(`[Debug] Searching for: "${keyword}"`);
  
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
    if (!response.ok) {
      throw new Error(`Search API failed: ${response.status}`);
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[Search] API failed:", error);
    return [];
  }
};

/**
 * Format products for Gemini context
 */
export const formatProductsForGemini = (products: any[]): string => {
  if (!products || products.length === 0) return "No specific products found";
  
  // Take top 3 products
  const topProducts = products.slice(0, 3);
  return topProducts.map((p, index) => {
    return `${index + 1}. ${p.name} (Price: ${p.final_price})`;
  }).join('\n');
};

/**
 * Step 3: Generate Post Content
 * Now accepts 'detectedProducts' and optional 'refinementInstruction'
 */
export const generatePostContent = async (
  inputTopic: string,
  platform: Platform,
  tone: Tone,
  detectedProducts: string = "",
  refinementInstruction: string = ""
): Promise<GeneratedPost> => {
  
  const systemInstruction = `
    You are a senior social media editor for Eslite Bookstore (誠品線上).
    Your audience loves reading, lifestyle, design, and art.
    Use Traditional Chinese (Taiwan).
    
    CRITICAL RULES:
    1. **LENGTH LIMIT**: The post content MUST be between 200 and 300 characters. Be concise and impactful.
    2. **FORMATTING**: Use actual newlines for line breaks. Do NOT use the string "\\n". Paragraphs should be clearly separated.
    3. **NO MARKDOWN**: Do not use bold (**text**) or italics inside the content body, except for hashtags.
  `;

  // Construct a prompt that incorporates the visual findings AND refinement
  let prompt = `
      Context: User wants a post about "${inputTopic}". 
      
      We searched Eslite's website. The following products were found: 
      "${detectedProducts}"
      
      Tone: ${tone}.
  `;

  if (refinementInstruction) {
    prompt += `
      \nIMPORTANT REFINEMENT INSTRUCTION: The user wants to adjust the previous draft. 
      Please follow this specific instruction: "${refinementInstruction}".
    `;
  }

  prompt += `
      \nTask: Write a short, engaging social media post. 
      Because the listed products were found, SPECIFICALLY MENTION 1 to 3 of them to recommend to the reader.
      Make the connection between the topic and these specific products.
      If no specific products were found, stick to the general lifestyle topic.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: "Post content, max 300 chars." },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedImagePrompt: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    // FIX: Parse newlines correctly. 
    let cleanContent = result.content || "";
    cleanContent = cleanContent.replace(/\\n/g, '\n');

    return {
        ...result,
        content: cleanContent
    };

  } catch (error) {
    console.error("Error generating post:", error);
    return {
      content: "貼文產生發生錯誤，請稍後再試。",
      hashtags: [],
    };
  }
};

/**
 * Step 3.5: Create Image Prompt
 */
export const generateImagePromptFromContent = async (postContent: string): Promise<string> => {
  try {
    const truncatedContent = postContent.slice(0, 1000); 

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Task: Create a PHOTOREALISTIC image prompt based on the following text.
        Text: "${truncatedContent}"
        
        Style Keywords: Professional photography, Kinfolk magazine style, 4k, soft natural lighting, depth of field, Canon 5D, lifestyle, elegant.
        Negative Constraints: NO cartoons, NO illustrations, NO drawing, NO text.
        
        Output: English prompt. 
        Describe the scene visually in detail using English. Keep it under 50 words.
      `,
    });
    return response.text?.trim() || "";
  } catch (e) {
    return "";
  }
};

/**
 * Step 4: Generate Image
 */
export const generatePostImage = async (imagePrompt: string): Promise<string> => {
  const enhancedPrompt = `
    High-end lifestyle photography, photorealistic, cinematic lighting, 8k resolution.
    Style: Minimalist, warm, elegant, similar to Eslite Bookstore commercial photography.
    Subject: ${imagePrompt}
    Technique: Shot on 35mm lens, f/1.8, soft bokeh.
    Constraints: ABSOLUTELY NO TEXT, NO WATERMARKS, NO CARTOONS, NO ILLUSTRATIONS.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: enhancedPrompt }] },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};
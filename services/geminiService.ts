import { GoogleGenAI, Type } from "@google/genai";
import { Platform, Tone, GeneratedPost } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper: Convert URL image to Base64 string for Gemini
const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Screenshot fetch failed: ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove data:image/jpeg;base64, prefix
      const base64String = (reader.result as string).replace(/^data:.+;base64,/, '');
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

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
 * Step 2: Search Eslite via APIFlash Screenshot (Full Page)
 * Returns the Base64 string of the screenshot
 */
export const searchEslitePage = async (keyword: string): Promise<string> => {
  console.log(`[Debug] Taking screenshot for: "${keyword}"`);
  
  try {
    // 1. Construct Eslite Search URL
    const safeKeyword = encodeURIComponent(keyword.trim());
    // Updated parameter from 'q' to 'keyword'
    const esliteSearchUrl = `https://www.eslite.com/Search?keyword=${safeKeyword}`;
    
    // 2. Construct APIFlash URL
    // Wait until page_loaded, delay 10s for lazy loading, fresh=true, full_page=true
    const encodedTargetUrl = encodeURIComponent(esliteSearchUrl);
    const apiFlashUrl = `https://api.apiflash.com/v1/urltoimage?access_key=451bf298d8ad46d6a087700a62ac34d5&wait_until=page_loaded&delay=10&fresh=true&full_page=true&format=jpeg&quality=80&url=${encodedTargetUrl}`;
    
    const base64Image = await urlToBase64(apiFlashUrl);
    
    return `data:image/jpeg;base64,${base64Image}`;

  } catch (error) {
    console.error("[Search] Screenshot failed:", error);
    return "";
  }
};

/**
 * Step 2.5: Analyze the Screenshot to find products
 */
export const analyzeScreenshot = async (base64Image: string): Promise<string> => {
  if (!base64Image) return "";
  
  try {
    // Strip header if present for Gemini API (though usually SDK handles it, detecting pure base64 is safer)
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: "Look at this Eslite bookstore search result page. List the titles of the top 3 to 5 books or products visible in the list. If no products are clearly visible, return 'No specific products found'."
          }
        ]
      }
    });
    
    const analysis = response.text?.trim() || "";
    console.log("[Analysis Result]:", analysis);
    return analysis;

  } catch (e) {
    console.error("Screenshot analysis failed", e);
    return "";
  }
}

/**
 * Step 3: Generate Post Content
 * Now accepts 'detectedProducts' context
 */
export const generatePostContent = async (
  inputTopic: string,
  platform: Platform,
  tone: Tone,
  detectedProducts: string = ""
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

  // Construct a prompt that incorporates the visual findings
  const prompt = `
      Context: User wants a post about "${inputTopic}". 
      
      We searched Eslite's website and found these products in the screenshot: 
      "${detectedProducts}"
      
      Tone: ${tone}.
      
      Task: Write a short, engaging social media post. 
      If the found products are relevant to the topic, SPECIFICALLY MENTION 1 or 2 of them to recommend to the reader.
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
        Output: English prompt only. Keep it under 50 words.
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

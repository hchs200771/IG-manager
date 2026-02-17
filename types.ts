export enum Platform {
  Instagram = 'Instagram',
  Facebook = 'Facebook',
  Threads = 'Threads'
}

export interface ProductInfo {
  id: string;
  name: string;
  brand?: string;
  price?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  manufacturer?: string;
}

export interface GeneratedPost {
  content: string;
  hashtags: string[];
  suggestedImagePrompt?: string;
}

export interface SavedPost extends GeneratedPost {
  id: string;
  timestamp: number;
  platform: Platform;
  tone: Tone;
  product: ProductInfo | null;
  generatedImageUrl?: string;
}

export enum Tone {
  Literary = '文青感性 (Literary)',
  Promotional = '銷售急迫 (Promotional)',
  Casual = '親切日常 (Casual)',
  Professional = '專業資訊 (Professional)'
}
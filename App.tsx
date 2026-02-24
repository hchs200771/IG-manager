import React, { useState, useEffect } from 'react';
import { Platform, Tone, SavedPost } from './types';
import PlatformSelector from './components/PlatformSelector';
import PostPreview from './components/PostPreview';
import { extractSearchKeyword, searchEsliteProducts, formatProductsForGemini, generatePostContent, generatePostImage, generateImagePromptFromContent } from './services/geminiService';
import { Search, PenTool, Loader2, Save, Trash2, History, FileText, RefreshCw, ExternalLink, Image as ImageIcon, Globe, Zap, MessageSquarePlus, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [userInput, setUserInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(Platform.Instagram);
  const [selectedTone, setSelectedTone] = useState<Tone>(Tone.Literary);
  const [enableSearch, setEnableSearch] = useState(true); // Toggle for search mode
  const [shouldRetakeScreenshot, setShouldRetakeScreenshot] = useState(true); // Toggle for re-taking screenshot inside search mode
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Track 1: Search Results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [detectedProducts, setDetectedProducts] = useState('');
  
  // Track 2: Content Result
  const [generatedText, setGeneratedText] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  
  // Refinement Inputs
  const [refinementText, setRefinementText] = useState(''); // Text refinement
  const [suggestedImagePrompt, setSuggestedImagePrompt] = useState(''); // Image prompt editing
  
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');

  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);

  // Load saved posts from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('eslite_saved_posts');
    if (saved) {
      try {
        setSavedPosts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved posts", e);
      }
    }
  }, []);

  const handleSave = () => {
    if (!generatedText) return;
    
    const newPost: SavedPost = {
      id: Date.now().toString(),
      content: generatedText,
      hashtags,
      suggestedImagePrompt,
      generatedImageUrl,
      platform: selectedPlatform,
      tone: selectedTone,
      product: null, 
      timestamp: Date.now()
    };
    
    const updated = [newPost, ...savedPosts];
    setSavedPosts(updated);
    localStorage.setItem('eslite_saved_posts', JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    const updated = savedPosts.filter(p => p.id !== id);
    setSavedPosts(updated);
    localStorage.setItem('eslite_saved_posts', JSON.stringify(updated));
  };

  const handleLoad = (post: SavedPost) => {
    setGeneratedText(post.content);
    setHashtags(post.hashtags);
    setSuggestedImagePrompt(post.suggestedImagePrompt || '');
    setGeneratedImageUrl(post.generatedImageUrl || '');
    setSelectedPlatform(post.platform);
    setSelectedTone(post.tone);
    setRefinementText('');
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Main Generation Workflow
  const handleGenerate = async () => {
    if (!userInput.trim()) return;
    
    setIsGenerating(true);
    // Clear outputs only if we are doing a full regeneration
    setGeneratedText('');
    setRefinementText('');
    
    // Only clear search results if we are re-taking it
    if (shouldRetakeScreenshot) {
      setSearchResults([]);
      setDetectedProducts('');
      setSearchKeyword('');
    }
    
    setGeneratedImageUrl('');
    
    try {
      let currentProducts = detectedProducts; // Use existing detected products by default

      // Decide whether to run Search logic
      const runSearch = enableSearch && (shouldRetakeScreenshot || searchResults.length === 0);

      if (runSearch) {
        // Step 1: Search API
        setStatusMessage('1/4 正在搜尋誠品商品...');
        const keyword = await extractSearchKeyword(userInput);
        setSearchKeyword(keyword);
        
        const productsList = await searchEsliteProducts(keyword);
        setSearchResults(productsList);

        // Step 2: Format Products
        setStatusMessage('2/4 正在分析商品資訊...');
        const productsStr = formatProductsForGemini(productsList);
        currentProducts = productsStr;
        setDetectedProducts(productsStr);
      } else if (!enableSearch) {
        setStatusMessage('1/2 跳過搜尋，正在根據輸入主題構思貼文...');
      } else {
        setStatusMessage('保留目前搜尋結果，正在重新撰寫文案...');
      }

      // Step 3: Generate Text
      const stepMsg = enableSearch ? '3/4' : '1/2';
      setStatusMessage(`${stepMsg} 正在撰寫社群貼文...`);
      const post = await generatePostContent(
        userInput, 
        selectedPlatform, 
        selectedTone,
        currentProducts
      );
      
      let hasGeneratedText = false;
      if (post && post.content) {
        setGeneratedText(post.content);
        setHashtags(post.hashtags);
        setSuggestedImagePrompt(post.suggestedImagePrompt || '');
        hasGeneratedText = true;
      }

      // Step 4: Generate Image
      if (hasGeneratedText) {
         const imgStepMsg = enableSearch ? '4/4' : '2/2';
         setStatusMessage(`${imgStepMsg} 正在繪製貼文配圖...`);
         const refinedPrompt = await generateImagePromptFromContent(post.content);
         setSuggestedImagePrompt(refinedPrompt);
         if (refinedPrompt) {
            try {
              const imgUrl = await generatePostImage(refinedPrompt);
              setGeneratedImageUrl(imgUrl);
            } catch (imgErr) {
              console.error("Image generation failed", imgErr);
              setStatusMessage('圖片繪製失敗，但文案已產生完成。');
            }
         }
      }

    } catch (e) {
      console.error("Generation failed", e);
      // Only show error if we haven't successfully generated text
      setGeneratedText(prev => prev ? prev : "抱歉，流程執行中發生錯誤，請稍後再試。");
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  // Refine Text Only
  const handleRegenerateTextOnly = async () => {
    if (!generatedText) return;
    setIsGenerating(true);
    setStatusMessage('依照新指示重新撰寫中...');
    
    try {
      const post = await generatePostContent(
        userInput,
        selectedPlatform,
        selectedTone,
        detectedProducts,
        refinementText // Pass the refinement text
      );
      
      setGeneratedText(post.content);
      setHashtags(post.hashtags);
      // We do NOT regenerate the image here to keep it independent, unless user explicitly asks
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  // Refine Image Only
  const handleRegenerateImageOnly = async () => {
    if (!suggestedImagePrompt) return;
    setIsGenerating(true);
    setStatusMessage('依照關鍵字重新繪圖中...');
    
    try {
      const imgUrl = await generatePostImage(suggestedImagePrompt);
      setGeneratedImageUrl(imgUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#333] font-sans">
      {/* Navbar */}
      <nav className="bg-[#354E41] text-white py-4 px-6 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-[#B4A792] flex items-center justify-center font-serif font-bold text-[#354E41]">E</div>
             <h1 className="text-xl font-serif tracking-wide">誠品社群貼文小幫手</h1>
          </div>
          <div className="text-xs text-[#B4A792] uppercase tracking-widest hidden sm:block">Editor Tool v2.0</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Controls & Input */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. Input Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex justify-between">
                <span>1. 輸入主題或關鍵字</span>
                {searchKeyword && searchKeyword !== userInput && enableSearch && (
                   <span className="text-xs text-gray-400 font-normal normal-case">AI 搜尋關鍵字: {searchKeyword}</span>
                )}
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="例如：過年大掃除秘訣、Dior 唇膏、村上春樹..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 bg-white focus:border-[#354E41] focus:ring-1 focus:ring-[#354E41] outline-none transition-all text-lg shadow-sm"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>

              {/* Mode Toggles */}
              <div className="mt-4 flex flex-col gap-2">
                {/* Search Toggle */}
                <div 
                  className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors select-none ${enableSearch ? 'bg-[#354E41]/5 border-[#354E41]/20' : 'bg-gray-50 border-gray-200'}`}
                  onClick={() => setEnableSearch(!enableSearch)}
                >
                  <div className="flex items-center gap-3">
                    {enableSearch ? (
                      <div className="p-1.5 bg-[#354E41] rounded-full text-white">
                        <Globe className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-orange-100 rounded-full text-orange-600">
                        <Zap className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${enableSearch ? 'text-[#354E41]' : 'text-gray-600'}`}>
                        {enableSearch ? '啟用誠品官網搜尋' : '快速模式 (不搜尋)'}
                      </span>
                    </div>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableSearch ? 'bg-[#354E41]' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableSearch ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>

                {/* Retake Search Toggle (Only if Search is Enabled) */}
                {enableSearch && (
                  <div 
                    className={`p-2 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors select-none ml-4 ${shouldRetakeScreenshot ? 'bg-white border-[#354E41]/30' : 'bg-gray-50 border-gray-200 opacity-80'}`}
                    onClick={() => setShouldRetakeScreenshot(!shouldRetakeScreenshot)}
                  >
                     <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${shouldRetakeScreenshot ? 'bg-[#354E41] border-[#354E41]' : 'bg-white border-gray-300'}`}>
                        {shouldRetakeScreenshot && <Sparkles className="w-3 h-3 text-white" />}
                     </div>
                     <span className="text-sm text-gray-600">每次產生時，重新搜尋商品</span>
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
               {isGenerating && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3 animate-fade-in">
                   <Loader2 className="w-5 h-5 animate-spin text-[#354E41]" />
                   <span className="text-sm text-gray-600 font-medium">{statusMessage}</span>
                </div>
              )}
            </div>

            {/* 2. Platform Selection */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                2. 選擇發布平台
              </label>
              <PlatformSelector selected={selectedPlatform} onChange={setSelectedPlatform} />
            </div>

            {/* 3. Tone Selection */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                3. 設定語氣風格
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(Tone).map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setSelectedTone(tone)}
                    className={`
                      py-2 px-3 rounded-lg text-xs font-medium border transition-colors
                      ${selectedTone === tone 
                        ? 'bg-[#354E41] text-white border-[#354E41]' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}
                    `}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!userInput || isGenerating}
              className={`
                w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all shadow-md
                ${(!userInput || isGenerating) 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-[#B4A792] text-[#354E41] hover:bg-[#A39682] hover:shadow-lg active:scale-[0.99]'}
              `}
            >
              {isGenerating ? (
                 <> <Loader2 className="w-5 h-5 animate-spin" /> 處理中... </>
              ) : (
                 <> <PenTool className="w-5 h-5" /> 產生貼文 </>
              )}
            </button>
            
            {/* -------------------- Editors Area -------------------- */}
            
            {generatedText && (
               <div className="space-y-4 animate-slide-up">
                 
                 {/* Text Editor */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                   <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">
                        文案編輯器
                      </label>
                      <button 
                        onClick={handleSave}
                        className="text-xs flex items-center gap-1 text-gray-600 hover:text-[#354E41] hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                        title="儲存草稿"
                      >
                        <Save className="w-3 h-3" /> 儲存
                      </button>
                   </div>
                   <textarea
                      value={generatedText}
                      onChange={(e) => setGeneratedText(e.target.value)}
                      className="w-full h-48 p-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-[#354E41] focus:ring-1 focus:ring-[#354E41] outline-none text-sm resize-none leading-relaxed"
                   />
                   <div className="mt-3 flex flex-wrap gap-2 mb-4">
                      {hashtags.map((tag, idx) => (
                        <span key={idx} className="text-xs bg-[#F5F5F0] text-[#354E41] px-2 py-1 rounded-full border border-[#E0DED5]">
                          {tag}
                        </span>
                      ))}
                   </div>
                   
                   {/* Text Refinement Input */}
                   <div className="pt-4 border-t border-gray-100">
                     <label className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                        <MessageSquarePlus className="w-3 h-3" /> 修改指令 (AI Refinement)
                     </label>
                     <div className="flex gap-2">
                       <input 
                          type="text" 
                          value={refinementText}
                          onChange={(e) => setRefinementText(e.target.value)}
                          placeholder="例如：語氣再活潑一點、強調商品折扣、縮短長度..."
                          className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-[#354E41] outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleRegenerateTextOnly()}
                       />
                       <button 
                          onClick={handleRegenerateTextOnly}
                          disabled={isGenerating}
                          className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1"
                       >
                         <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} /> 
                         修改文案
                       </button>
                     </div>
                   </div>
                 </div>

                 {/* Image Prompt Editor */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                   <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> 圖片生成設定
                   </label>
                   <p className="text-xs text-gray-400 mb-2">編輯下方的圖片提示詞 (Prompt) 來調整圖片風格或內容。</p>
                   <textarea
                      value={suggestedImagePrompt}
                      onChange={(e) => setSuggestedImagePrompt(e.target.value)}
                      className="w-full h-24 p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 focus:border-[#354E41] focus:bg-white outline-none text-xs resize-none font-mono leading-relaxed"
                   />
                   <div className="mt-3 flex justify-end">
                      <button 
                          onClick={handleRegenerateImageOnly}
                          disabled={isGenerating}
                          className="bg-[#354E41] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2c4036] transition-colors flex items-center gap-2 shadow-sm"
                       >
                         <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} /> 
                         重新產生圖片
                       </button>
                   </div>
                 </div>
               </div>
            )}

            {/* Saved Drafts Section */}
            {savedPosts.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-slide-up">
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4" />
                  歷史草稿 ({savedPosts.length})
                </label>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {savedPosts.map(post => (
                    <div key={post.id} className="p-3 border border-gray-100 rounded-lg hover:border-[#354E41] hover:shadow-sm transition-all group bg-gray-50/50">
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium
                             ${post.platform === Platform.Instagram ? 'bg-pink-50 text-pink-600 border-pink-100' :
                               post.platform === Platform.Facebook ? 'bg-blue-50 text-blue-600 border-blue-100' :
                               'bg-gray-100 text-gray-600 border-gray-200'
                             }
                          `}>
                            {post.platform}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(post.timestamp).toLocaleDateString()} {new Date(post.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2 leading-relaxed">{post.content}</p>
                      
                      <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleLoad(post)}
                            className="flex items-center gap-1 text-xs text-[#354E41] font-medium hover:bg-[#354E41]/10 px-2 py-1 rounded transition-colors"
                          >
                            <FileText className="w-3 h-3" /> 載入編輯
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Live Preview */}
          <div className="lg:col-span-7">
             <div className="sticky top-28 space-y-6">
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-4">
                  <div className="h-[1px] bg-gray-300 w-12 lg:hidden"></div>
                  <h2 className="text-gray-400 font-serif italic text-lg text-center lg:text-left">
                    Live Preview • {selectedPlatform}
                  </h2>
                  <div className="h-[1px] bg-gray-300 w-12 lg:hidden"></div>
                </div>

                <div className="bg-[#E0DED5] p-8 rounded-3xl min-h-[600px] flex items-center justify-center shadow-inner relative overflow-hidden">
                   {/* Background decoration */}
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                   <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#354E41] opacity-5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                   {generatedText || isGenerating ? (
                      <div className={`transition-all duration-500 w-full ${isGenerating && !generatedText ? 'opacity-50 blur-sm scale-95' : 'opacity-100 scale-100'}`}>
                         <PostPreview 
                            platform={selectedPlatform} 
                            content={generatedText || "正在為您撰寫精彩內容..."} 
                            hashtags={hashtags}
                            product={null} // Simplified: No specific product link in preview for now
                            suggestedImagePrompt={suggestedImagePrompt}
                            generatedImageUrl={generatedImageUrl}
                         />
                      </div>
                   ) : (
                      <div className="text-center text-gray-500 max-w-sm">
                        <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <PlatformSelectorIcon />
                        </div>
                        <h3 className="font-serif text-xl text-[#354E41] mb-2">準備開始</h3>
                        <p className="text-sm opacity-70">輸入主題或商品，點擊「產生貼文」，AI 將為您截取搜尋頁面並撰寫貼文。</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Search Results Section at the bottom */}
        {/* Only show if enableSearch is true AND we have results or are generating */}
        {enableSearch && (searchResults.length > 0 || (isGenerating && !generatedText)) && (
          <div className="mt-12 pt-8 border-t border-gray-200 animate-slide-up">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-gray-700 uppercase flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#354E41]" />
                  誠品搜尋結果 {searchKeyword && <span className="text-sm font-normal text-gray-500">(關鍵字: {searchKeyword})</span>}
                </span>
                {searchKeyword && (
                  <a 
                    href={`https://www.eslite.com/Search?keyword=${encodeURIComponent(searchKeyword)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#354E41] hover:underline flex items-center gap-1 font-medium bg-white px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    開啟原始網頁 <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              
              <div className="w-full bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden min-h-[300px] relative p-6">
                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {searchResults.slice(0, 10).map((product, idx) => (
                        <div key={idx} className="border border-gray-100 rounded-lg p-3 hover:shadow-md transition-shadow">
                          <div className="aspect-square mb-3 overflow-hidden rounded bg-gray-50">
                            {product.product_photo_url ? (
                              <img src={product.product_photo_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          <h4 className="text-xs font-medium text-gray-800 line-clamp-2 mb-1" title={product.name}>{product.name}</h4>
                          <p className="text-[#354E41] font-bold text-sm">${product.final_price}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-gray-400 gap-3">
                       <Loader2 className="w-10 h-10 animate-spin text-[#354E41]" />
                       <div className="text-sm font-medium">{statusMessage || '正在搜尋商品...'}</div>
                    </div>
                  )}
              </div>
          </div>
        )}

      </main>
    </div>
  );
};

const PlatformSelectorIcon = () => {
  return <PenTool className="w-8 h-8 text-[#354E41]" />;
}

export default App;
import React, { useState, useEffect, useRef } from 'react';
import type { RouterConfig } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function AIAssistant() {
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'こんにちは。AIネットワーク管理者です。設定の変更や状態の確認など、どのようなご用件でしょうか？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveApiKey = async (key: string) => {
    if (!config) return;
    const newConfig = { ...config, gemini_api_key: key };
    setConfig(newConfig);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: key })
    });
    alert('Gemini APIキーを保存しました。');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !config?.gemini_api_key) return;

    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', text: userMsg } as Message];
    setMessages(newHistory);
    setLoading(true);

    try {
      const formatHistory = newHistory.slice(1).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      // Remove last user message since we pass it explicitly
      formatHistory.pop();

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: formatHistory })
      });
      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, { role: 'model', text: `エラーが発生しました: ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: `通信エラーが発生しました。` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  if (!config.gemini_api_key) {
    return (
      <div>
        <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
          AI ネットワークアシスタント設定
        </h2>
        <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
          <p className="mb-4 text-xs">ルーターの管理を対話型で行うには、Gemini APIキーを設定してください。</p>
          <div className="flex gap-2 items-center">
            <input 
              type="password" 
              placeholder="Gemini API Key..." 
              className="border border-[#aaa] p-1.5 w-1/2 font-mono text-sm"
              onKeyDown={e => e.key === 'Enter' && saveApiKey(e.currentTarget.value)}
              onBlur={e => saveApiKey(e.target.value)}
            />
            <span className="text-xs text-[#666]">入力してEnterまたはフォーカスを外すと保存されます</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between">
        <span>AI ネットワークアシスタント (Gemini)</span>
        <button onClick={() => saveApiKey('')} className="text-xs text-[#cc0000] underline">APIキーを削除</button>
      </h2>
      
      <div className="border border-[#cccccc] bg-white flex-1 flex flex-col overflow-hidden min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-4 bg-[#f9f9f9]">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 max-w-[80%] whitespace-pre-wrap text-sm shadow-sm ${msg.role === 'user' ? 'bg-[#003399] text-white' : 'bg-white border border-[#ccc] text-[#333]'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mb-4 flex justify-start">
              <div className="p-3 max-w-[80%] bg-white border border-[#ccc] text-[#333] text-sm shadow-sm italic">
                考え中...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <form onSubmit={handleSend} className="p-3 bg-[#eef3f6] border-t border-[#cccccc] flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)}
            placeholder="例: 無線を5GHz帯に変更して、SSIDを「Guest_WIFI」にして。"
            className="flex-1 border border-[#aaa] p-2 text-sm focus:outline-none focus:border-[#003399]"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-[#003399] border border-[#002266] text-white px-6 py-2 font-bold text-sm hover:bg-[#0044cc] disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}

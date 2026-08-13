import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function PortalEditor() {
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState(false);
  const [config, setConfig] = useState<RouterConfig | null>(null);

  useEffect(() => {
    fetch('/api/portal/html').then(r => r.text()).then(setHtml);
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSave = async () => {
    await fetch('/api/portal/html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    });
    if (config) {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captcha_provider: config.captcha_provider,
          captcha_site_key: config.captcha_site_key,
          captcha_secret_key: config.captcha_secret_key,
          captcha_invisible: config.captcha_invisible
        })
      });
    }
    alert('ポータル設定を保存しました。');
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-center shrink-0">
        <span>キャプティブポータル・認証設定</span>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs font-normal text-black">
            {preview ? 'コード編集に戻る' : 'プレビュー表示'}
          </button>
          <button onClick={handleSave} className="bg-[#003399] border border-[#002266] text-white px-3 py-1 font-bold text-xs hover:bg-[#0044cc]">
            保存
          </button>
        </div>
      </h2>

      {config && (
        <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
          <p className="mb-4 text-xs font-bold text-[#333]">ボット対策・認証プロバイダ設定</p>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-2">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">プロバイダ</th>
                <td className="border border-[#cccccc] p-2">
                  <select value={config.captcha_provider || 'hcaptcha'} onChange={e=>setConfig({...config, captcha_provider: e.target.value as any})} className="border border-[#aaa] p-1 w-[50%]">
                    <option value="hcaptcha">hCaptcha (推奨)</option>
                    <option value="recaptcha">Google reCAPTCHA v2</option>
                  </select>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">認証UI表示モード</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="mr-4"><input type="radio" checked={config.captcha_invisible !== true} onChange={() => setConfig({...config, captcha_invisible: false})} className="mr-1" /> HTML内埋め込み (通常)</label>
                  <label><input type="radio" checked={config.captcha_invisible === true} onChange={() => setConfig({...config, captcha_invisible: true})} className="mr-1" /> 自動認証・不可視 (Invisible)</label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Site Key</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="text" value={config.captcha_site_key || ''} onChange={e=>setConfig({...config, captcha_site_key: e.target.value})} className="border border-[#aaa] p-1 w-[80%] font-mono" placeholder="デフォルトキーを使用" />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Secret Key</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="password" value={config.captcha_secret_key || ''} onChange={e=>setConfig({...config, captcha_secret_key: e.target.value})} className="border border-[#aaa] p-1 w-[80%] font-mono" placeholder="デフォルトキーを使用" />
                </td>
              </tr>
            </tbody>
          </table>
          {config.captcha_invisible && (
            <p className="text-xs text-[#cc0000] mt-2">※「自動認証」を有効にした場合、HTML内にフォームを埋め込まなくても、ページ表示時またはボタン押下時に自動で認証チェックが行われます。</p>
          )}
        </div>
      )}

      <div className="border border-[#cccccc] bg-[#fafafa] overflow-hidden min-h-[500px]">
        {preview ? (
          <iframe srcDoc={html} className="w-full h-full border-none bg-white min-h-[500px]" title="Portal Preview" />
        ) : (
          <textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm bg-[#ffffff] border-none focus:outline-none resize-none leading-relaxed min-h-[500px]"
            spellCheck="false"
          />
        )}
      </div>
    </div>
  );
}

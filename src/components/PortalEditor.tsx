import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function PortalEditor() {
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState(false);
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    fetch('/api/portal/html').then(r => r.text()).then(setHtml);
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const notify = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

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
          portal_enabled: config.portal_enabled !== false,
          captcha_provider: config.captcha_provider || 'none',
          portal_passcode: config.portal_passcode || '1234',
          captcha_site_key: config.captcha_site_key || '',
          captcha_secret_key: config.captcha_secret_key || '',
          captcha_invisible: Boolean(config.captcha_invisible),
          session_timeout: Number(config.session_timeout || 15)
        })
      });
      await fetch('/api/routing/reload', { method: 'POST' });
    }
    notify('ポータル設定（CAPTCHA無効化・認証方式）を保存し、ファイアウォールへ即時反映しました。');
  };

  const handleClearSessions = async () => {
    await fetch('/api/portal/reset', { method: 'POST' });
    notify('現在認証中のすべての端末セッションを強制終了しました。');
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-center shrink-0">
        <span>キャプティブポータル・認証設定 (CAPTCHAなし対応)</span>
        <div className="flex gap-2">
          <button onClick={handleClearSessions} className="bg-[#cc0000] border border-[#990000] hover:bg-[#aa0000] px-3 py-1 text-xs text-white cursor-pointer">
            認証セッションを一括クリア
          </button>
          <button onClick={() => setPreview(!preview)} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs font-normal text-black cursor-pointer">
            {preview ? 'コード編集に戻る' : 'プレビュー表示'}
          </button>
          <button onClick={handleSave} className="bg-[#003399] border border-[#002266] text-white px-3 py-1 font-bold text-xs hover:bg-[#0044cc] cursor-pointer">
            設定を保存・適用
          </button>
        </div>
      </h2>

      {statusMsg && (
        <div className="bg-[#ecfdf5] border border-[#10b981] text-[#065f46] px-4 py-2 mb-4 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      {config && (
        <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
          <p className="mb-3 text-xs font-bold text-[#333]">ポータル動作モード・認証方式設定</p>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-2">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">キャプティブポータル機能</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="mr-5 cursor-pointer">
                    <input
                      type="radio"
                      checked={config.portal_enabled !== false}
                      onChange={() => setConfig({ ...config, portal_enabled: true })}
                      className="mr-1.5"
                    />
                    <strong>有効</strong> (未認証端末にポータル画面を表示)
                  </label>
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      checked={config.portal_enabled === false}
                      onChange={() => setConfig({ ...config, portal_enabled: false })}
                      className="mr-1.5"
                    />
                    <strong>無効 / スルーモード</strong> (ポータル認証なしで全端末が即インターネット接続)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">認証システム (reCAPTCHA設定)</th>
                <td className="border border-[#cccccc] p-2">
                  <select
                    value={config.captcha_provider || 'none'}
                    onChange={e => setConfig({ ...config, captcha_provider: e.target.value as any })}
                    className="border border-[#aaa] p-1.5 w-[70%] font-bold text-[#003399]"
                  >
                    <option value="none">CAPTCHAなし（利用規約同意のみ・ワンタップ接続）【推奨】</option>
                    <option value="passcode">ゲストパスコード（PIN / 合言葉）認証【完全オフライン対応】</option>
                    <option value="hcaptcha">hCaptcha 認証（外部スクリプト）</option>
                    <option value="recaptcha">Google reCAPTCHA v2 認証（外部スクリプト）</option>
                  </select>
                </td>
              </tr>
              {config.captcha_provider === 'passcode' && (
                <tr>
                  <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ゲスト接続パスコード</th>
                  <td className="border border-[#cccccc] p-2">
                    <input
                      type="text"
                      value={config.portal_passcode || '1234'}
                      onChange={e => setConfig({ ...config, portal_passcode: e.target.value })}
                      className="border border-[#aaa] p-1 w-[200px] font-mono font-bold"
                      placeholder="例: 1234"
                    />
                    <span className="text-xs text-[#666] ml-2">※ポータル画面で入力を求める共通パスワードです（reCAPTCHA不要）</span>
                  </td>
                </tr>
              )}
              {(config.captcha_provider === 'recaptcha' || config.captcha_provider === 'hcaptcha') && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Site Key</th>
                    <td className="border border-[#cccccc] p-2">
                      <input
                        type="text"
                        value={config.captcha_site_key || ''}
                        onChange={e => setConfig({ ...config, captcha_site_key: e.target.value })}
                        className="border border-[#aaa] p-1 w-[80%] font-mono"
                        placeholder="空欄時はテスト用キーを使用"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Secret Key</th>
                    <td className="border border-[#cccccc] p-2">
                      <input
                        type="password"
                        value={config.captcha_secret_key || ''}
                        onChange={e => setConfig({ ...config, captcha_secret_key: e.target.value })}
                        className="border border-[#aaa] p-1 w-[80%] font-mono"
                        placeholder="空欄時はテスト用キーを使用"
                      />
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">セッション有効期限 (分)</th>
                <td className="border border-[#cccccc] p-2">
                  <input
                    type="number"
                    value={config.session_timeout || 15}
                    onChange={e => setConfig({ ...config, session_timeout: Number(e.target.value) })}
                    className="border border-[#aaa] p-1 w-[80px] font-mono"
                    min={1}
                  />{' '}
                  分間
                  <span className="text-xs text-[#666] ml-2">（※経過後は自動的に再認証が必要になります。無制限にしたい場合は 10080 [7日間] 等を指定）</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-[#047857] font-bold mt-2">
            ✓ 現在「{config.captcha_provider === 'none' || !config.captcha_provider ? 'CAPTCHAなし（ワンタップ接続）' : config.captcha_provider}」が選択されています。外部reCAPTCHAによるブロックや表示不具合なしで即座に認証できます。
          </p>
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

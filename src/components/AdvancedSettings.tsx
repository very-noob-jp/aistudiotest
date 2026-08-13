import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function AdvancedSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strict_ip_binding: config.strict_ip_binding, adblock_enabled: config.adblock_enabled })
    });
    alert('ファイアウォール・フィルタ設定を適用しました。');
  };

  const handleSaveSyslog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/syslog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syslog_server: config.syslog_server, syslog_port: config.syslog_port })
    });
    alert('Syslog転送設定を適用しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        ファイアウォール・フィルタ設定
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">不正アクセス防止や広告ブロックなどの高度なセキュリティ設定です。</p>
        <form onSubmit={handleSaveSecurity}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">厳格なMACバインディング</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center">
                    <input type="checkbox" checked={config.strict_ip_binding} onChange={e => setConfig({...config, strict_ip_binding: e.target.checked})} className="mr-2" />
                    有効にする (IPアドレスが変わった際、再ログインを要求します)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">DNS広告・トラッキングブロック</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center">
                    <input type="checkbox" checked={config.adblock_enabled} onChange={e => setConfig({...config, adblock_enabled: e.target.checked})} className="mr-2" />
                    有効にする (53番ポートの通信を内部のフィルタDNSへリダイレクトします)
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            設定適用
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        リモートログ転送 (Syslog)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">ルーターのシステムログを外部のSyslogサーバー（Splunk、Datadog、NASなど）にリアルタイムで転送します。</p>
        <form onSubmit={handleSaveSyslog}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Syslogサーバー IP/ホスト名</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="text" value={config.syslog_server || ''} onChange={e => setConfig({...config, syslog_server: e.target.value})} placeholder="空欄で無効化" className="border border-[#aaa] p-1 w-[80%]" />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ポート番号 (UDP)</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="number" value={config.syslog_port || '514'} onChange={e => setConfig({...config, syslog_port: e.target.value})} className="border border-[#aaa] p-1 w-[30%]" />
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            設定適用
          </button>
        </form>
      </div>
    </div>
  );
}

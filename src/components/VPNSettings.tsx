import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function VPNSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/vpn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    await fetch('/api/config/wg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    alert('VPN設定を適用しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        リモートアクセス VPN (IPsec / L2TP)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">外出先からインターネット経由で安全にLANへアクセスするためのVPNサーバー機能です。</p>
        <form onSubmit={handleSave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">VPNサーバー機能</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" checked={config.vpn_enabled === true} onChange={() => setConfig({...config, vpn_enabled: true})} className="mr-1" /> 動作する (有効)</label>
                   <label><input type="radio" checked={config.vpn_enabled === false} onChange={() => setConfig({...config, vpn_enabled: false})} className="mr-1" /> 動作しない (無効)</label>
                </td>
              </tr>
              {config.vpn_enabled && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">接続タイプ</th>
                    <td className="border border-[#cccccc] p-2">
                      <select value={config.vpn_type || 'l2tp'} onChange={e=>setConfig({...config, vpn_type: e.target.value as any})} className="border border-[#aaa] p-1 w-[50%]">
                        <option value="l2tp">L2TP/IPsec (推奨)</option>
                        <option value="ipsec">IPsec IKEv2</option>
                        <option value="openvpn">OpenVPN</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">事前共有鍵 (PSK)</th>
                    <td className="border border-[#cccccc] p-2">
                      <input type="text" value={config.vpn_psk || ''} onChange={e=>setConfig({...config, vpn_psk: e.target.value})} className="border border-[#aaa] p-1 w-[80%] font-mono" required />
                      <div className="text-[11px] text-[#666] mt-1">※クライアント側で入力するIPsec事前共有鍵です。</div>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            設定の確定
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        WireGuard VPN サーバー
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">次世代の高速・高セキュリティなVPNプロトコルです。Raspberry Pi 4Bの性能を最大限に引き出せます。</p>
        <form onSubmit={handleSave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">サーバー機能</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" checked={config.wg_enabled === true} onChange={() => setConfig({...config, wg_enabled: true})} className="mr-1" /> 有効</label>
                   <label><input type="radio" checked={config.wg_enabled === false} onChange={() => setConfig({...config, wg_enabled: false})} className="mr-1" /> 無効</label>
                </td>
              </tr>
              {config.wg_enabled && (
                <tr>
                  <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Listen ポート (UDP)</th>
                  <td className="border border-[#cccccc] p-2">
                    <input type="number" value={config.wg_port || '51820'} onChange={e=>setConfig({...config, wg_port: e.target.value})} className="border border-[#aaa] p-1 w-[50%]" required />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            設定の確定
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        VPN接続ユーザー管理 (認証データベース)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4 text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">ユーザー名</th>
              <th className="border border-[#cccccc] p-2 font-normal">パスワード</th>
              <th className="border border-[#cccccc] p-2 font-normal">割当IPアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal w-20">削除</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={4} className="border border-[#cccccc] p-4 text-[#666]">登録されているユーザーはいません。</td></tr>
          </tbody>
        </table>
        <div className="flex gap-2 items-center bg-[#eef3f6] p-3 border border-[#cccccc] opacity-50 pointer-events-none">
          <span className="text-xs font-bold mr-2 text-[#333]">新規追加:</span>
          <input type="text" placeholder="ユーザー名" className="border border-[#aaa] p-1 w-1/4 text-xs" disabled />
          <input type="password" placeholder="パスワード" className="border border-[#aaa] p-1 w-1/4 text-xs" disabled />
          <button className="bg-[#003399] border border-[#002266] text-white px-3 py-1 font-bold text-xs">追加</button>
        </div>
      </div>
    </div>
  );
}

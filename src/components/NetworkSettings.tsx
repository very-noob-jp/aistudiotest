import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function NetworkSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/lan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    // Save DNS setting too
    await fetch('/api/config/dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_dns_enabled: config.local_dns_enabled, local_dns_name: config.local_dns_name })
    });
    
    alert('LAN / DHCP・DNS設定を適用しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        LANインターフェース設定
      </h2>
      <form onSubmit={handleSave}>
        <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
          <p className="mb-4 text-xs">ルーターのLAN側IPアドレスおよびサブネットマスクを設定します。</p>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">IPアドレス</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="text" value={config.lan_ip || ''} onChange={e=>setConfig({...config, lan_ip: e.target.value})} className="border border-[#aaa] p-1 w-[50%]" required />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">サブネットマスク</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="text" value={config.subnet_mask || ''} onChange={e=>setConfig({...config, subnet_mask: e.target.value})} className="border border-[#aaa] p-1 w-[50%]" required />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
          DHCPサーバー機能
        </h2>
        <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
          <p className="mb-4 text-xs">LAN内に接続された端末にIPアドレスを自動的に割り当てる設定です。</p>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">DHCPサーバー</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" checked={config.dhcp_enabled === true} onChange={() => setConfig({...config, dhcp_enabled: true})} className="mr-1" /> 有効</label>
                   <label><input type="radio" checked={config.dhcp_enabled === false} onChange={() => setConfig({...config, dhcp_enabled: false})} className="mr-1" /> 無効</label>
                </td>
              </tr>
              {config.dhcp_enabled && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">割当IPアドレス範囲</th>
                    <td className="border border-[#cccccc] p-2 flex items-center gap-2">
                      <input type="text" value={config.dhcp_start || ''} onChange={e=>setConfig({...config, dhcp_start: e.target.value})} className="border border-[#aaa] p-1 w-[40%]" required />
                      <span>～</span>
                      <input type="text" value={config.dhcp_end || ''} onChange={e=>setConfig({...config, dhcp_end: e.target.value})} className="border border-[#aaa] p-1 w-[40%]" required />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">リースタイム</th>
                    <td className="border border-[#cccccc] p-2">
                      <select value={config.lease_time || '24h'} onChange={e=>setConfig({...config, lease_time: e.target.value})} className="border border-[#aaa] p-1 w-[50%]">
                        <option value="1h">1時間 (1h)</option>
                        <option value="12h">12時間 (12h)</option>
                        <option value="24h">24時間 (24h)</option>
                        <option value="168h">7日間 (168h)</option>
                      </select>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

        <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
          ローカルDNS設定 (名前解決)
        </h2>
          <p className="mb-4 text-xs">ルーターの管理画面にIPアドレスの代わりにお好きな名前（例: router.local）でアクセスできるようにします。</p>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ローカル名前解決</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" checked={config.local_dns_enabled === true} onChange={() => setConfig({...config, local_dns_enabled: true})} className="mr-1" /> 有効</label>
                   <label><input type="radio" checked={config.local_dns_enabled === false} onChange={() => setConfig({...config, local_dns_enabled: false})} className="mr-1" /> 無効</label>
                </td>
              </tr>
              {config.local_dns_enabled && (
                <tr>
                  <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ホスト名</th>
                  <td className="border border-[#cccccc] p-2">
                    <input type="text" value={config.local_dns_name || ''} onChange={e=>setConfig({...config, local_dns_name: e.target.value})} className="border border-[#aaa] p-1 w-[50%]" required placeholder="例: aterm.me, pi.router" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            設定の確定
          </button>
        </div>
      </form>
    </div>
  );
}

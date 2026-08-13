import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function NASSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/nas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    alert('簡易NAS・USBストレージ共有設定を適用しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        簡易NAS・USBストレージ共有 (Samba)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">Raspberry Pi 4BのUSBポートに接続された外部ストレージを、LAN内のPCからネットワークドライブとして利用できるようにします。</p>
        <form onSubmit={handleSave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">機能の有効化</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" checked={config.nas_enabled === true} onChange={() => setConfig({...config, nas_enabled: true})} className="mr-1" /> 有効にする</label>
                   <label><input type="radio" checked={config.nas_enabled === false} onChange={() => setConfig({...config, nas_enabled: false})} className="mr-1" /> 無効にする</label>
                </td>
              </tr>
              {config.nas_enabled && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">共有名 (Share Name)</th>
                    <td className="border border-[#cccccc] p-2">
                      <input type="text" value={config.nas_share_name || ''} onChange={e=>setConfig({...config, nas_share_name: e.target.value})} className="border border-[#aaa] p-1 w-[50%]" required />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ワークグループ</th>
                    <td className="border border-[#cccccc] p-2">
                      <input type="text" value={config.nas_workgroup || ''} onChange={e=>setConfig({...config, nas_workgroup: e.target.value})} className="border border-[#aaa] p-1 w-[50%]" required />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">アクセス制御</th>
                    <td className="border border-[#cccccc] p-2 text-xs text-[#666]">
                      現在は「ゲストアクセス(パスワードなし)」のみをサポートしています。/mnt/usb_share が公開されます。
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
    </div>
  );
}

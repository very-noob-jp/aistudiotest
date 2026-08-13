import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function QoSSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/qos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    alert('帯域制御(QoS)設定を適用しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        帯域制御 (トラフィックシェーピング / QoS)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">WANインターフェースにおける通信速度の最大値を設定し、特定の通信がネットワーク帯域を独占することを防ぎます。(tc / fq_codel アルゴリズムを使用)</p>
        <form onSubmit={handleSave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">帯域制御機能</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" checked={config.qos_enabled === true} onChange={() => setConfig({...config, qos_enabled: true})} className="mr-1" /> 有効にする</label>
                   <label><input type="radio" checked={config.qos_enabled === false} onChange={() => setConfig({...config, qos_enabled: false})} className="mr-1" /> 無効にする</label>
                </td>
              </tr>
              {config.qos_enabled && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">最大ダウンロード速度</th>
                    <td className="border border-[#cccccc] p-2">
                      <div className="flex items-center">
                        <input type="number" value={config.qos_download || ''} onChange={e=>setConfig({...config, qos_download: e.target.value})} className="border border-[#aaa] p-1 w-24 text-right" required />
                        <span className="ml-2">Mbps</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">最大アップロード速度</th>
                    <td className="border border-[#cccccc] p-2">
                      <div className="flex items-center">
                        <input type="number" value={config.qos_upload || ''} onChange={e=>setConfig({...config, qos_upload: e.target.value})} className="border border-[#aaa] p-1 w-24 text-right" required />
                        <span className="ml-2">Mbps</span>
                      </div>
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

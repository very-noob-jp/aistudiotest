import React, { useState, useEffect } from 'react';
import type { RouterConfig, StaticRoute } from '../types';

export default function RoutingSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);
  
  // NAPT State
  const [srcPort, setSrcPort] = useState('');
  const [destIp, setDestIp] = useState('');
  const [destPort, setDestPort] = useState('');

  // Static Route State
  const [routeDest, setRouteDest] = useState('');
  const [routeGw, setRouteGw] = useState('');
  const [routeMetric, setRouteMetric] = useState('1');

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const addPortFwd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/routing/portfwd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src_port: srcPort, dest_ip: destIp, dest_port: destPort })
    });
    if (res.ok) {
      alert('ポートマッピングを追加しました。');
      setSrcPort(''); setDestIp(''); setDestPort('');
    }
  };

  const manageRoute = async (action: 'add' | 'del', route: any) => {
    const res = await fetch('/api/routing/static', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, route })
    });
    if (res.ok) {
      alert(`ルーティングテーブルを${action === 'add' ? '追加' : '削除'}しました。`);
      fetch('/api/config').then(r => r.json()).then(setConfig);
      setRouteDest(''); setRouteGw('');
    }
  };

  const reloadRouting = async () => {
    await fetch('/api/routing/reload', { method: 'POST' });
    alert('ルーティングを再構築しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between">
        <span>静的ルーティング設定</span>
        <button onClick={reloadRouting} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs font-normal text-black">
          ルーティング再構築 (リロード)
        </button>
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4 text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">宛先ネットワーク (CIDR)</th>
              <th className="border border-[#cccccc] p-2 font-normal">ゲートウェイ (Next Hop)</th>
              <th className="border border-[#cccccc] p-2 font-normal">メトリック</th>
              <th className="border border-[#cccccc] p-2 font-normal w-20">削除</th>
            </tr>
          </thead>
          <tbody>
            {(config.static_routes || []).map(r => (
              <tr key={r.id}>
                <td className="border border-[#cccccc] p-2">{r.dest}</td>
                <td className="border border-[#cccccc] p-2">{r.gateway}</td>
                <td className="border border-[#cccccc] p-2">{r.metric}</td>
                <td className="border border-[#cccccc] p-2">
                  <button onClick={() => manageRoute('del', r)} className="bg-[#cc0000] border border-[#990000] text-white px-2 py-0.5 text-xs hover:bg-[#aa0000]">削除</button>
                </td>
              </tr>
            ))}
            {(config.static_routes || []).length === 0 && (
              <tr><td colSpan={4} className="border border-[#cccccc] p-4 text-[#666]">登録されている経路はありません。</td></tr>
            )}
          </tbody>
        </table>
        
        <form onSubmit={e => { e.preventDefault(); manageRoute('add', { dest: routeDest, gateway: routeGw, metric: routeMetric }); }} className="flex gap-2 items-center bg-[#eef3f6] p-3 border border-[#cccccc]">
          <input type="text" placeholder="宛先 (例: 10.0.0.0/24)" value={routeDest} onChange={e=>setRouteDest(e.target.value)} className="border border-[#aaa] p-1 w-1/3 text-xs" required />
          <input type="text" placeholder="ゲートウェイ (例: 192.168.4.254)" value={routeGw} onChange={e=>setRouteGw(e.target.value)} className="border border-[#aaa] p-1 w-1/3 text-xs" required />
          <input type="number" placeholder="Metric" value={routeMetric} onChange={e=>setRouteMetric(e.target.value)} className="border border-[#aaa] p-1 w-20 text-xs" required />
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-3 py-1 font-bold text-xs hover:bg-[#0044cc]">追加</button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        ポートマッピング (NAPT / ポートフォワード)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <p className="mb-4 text-xs">WAN側から特定のポートへのアクセスを、LAN側の特定PCへ転送します。</p>
        <form onSubmit={addPortFwd}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">転送元ポート (WAN側)</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="number" value={srcPort} onChange={e=>setSrcPort(e.target.value)} className="border border-[#aaa] p-1 w-[50%]" required />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">転送先IPアドレス (LAN側)</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="text" value={destIp} onChange={e=>setDestIp(e.target.value)} className="border border-[#aaa] p-1 w-[50%]" required placeholder="例: 192.168.4.10" />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">転送先ポート (LAN側)</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="number" value={destPort} onChange={e=>setDestPort(e.target.value)} className="border border-[#aaa] p-1 w-[50%]" required />
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            マッピング追加
          </button>
        </form>
      </div>
    </div>
  );
}

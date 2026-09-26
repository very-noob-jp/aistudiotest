import React, { useState, useEffect } from 'react';
import type { RouterConfig, PortForwardRule } from '../types';

export default function RoutingSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // NAPT State
  const [ruleName, setRuleName] = useState('');
  const [protocol, setProtocol] = useState<'tcp' | 'udp' | 'both'>('both');
  const [srcPort, setSrcPort] = useState('');
  const [destIp, setDestIp] = useState('');
  const [destPort, setDestPort] = useState('');

  // Static Route State
  const [routeDest, setRouteDest] = useState('');
  const [routeGw, setRouteGw] = useState('');
  const [routeMetric, setRouteMetric] = useState('10');

  const fetchConfig = () => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const notify = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const addPortFwd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/routing/portfwd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ruleName || `Port ${srcPort}`,
        protocol,
        src_port: srcPort,
        dest_ip: destIp,
        dest_port: destPort || srcPort
      })
    });
    if (res.ok) {
      setRuleName('');
      setSrcPort('');
      setDestIp('');
      setDestPort('');
      fetchConfig();
      notify('ポート開放 (NAPT DNAT) ルールを追加し、iptables へ即時適用しました。');
    }
  };

  const handleRuleAction = async (action: 'del' | 'toggle', rule: PortForwardRule) => {
    const res = await fetch('/api/routing/portfwd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rule })
    });
    if (res.ok) {
      fetchConfig();
      notify(action === 'del' ? 'ポート開放ルールを削除しました。' : 'ポート開放ルールの有効状態を切り替えました。');
    }
  };

  const saveNatOptions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    const res = await fetch('/api/routing/nat-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dmz_enabled: Boolean(config.dmz_enabled),
        dmz_ip: config.dmz_ip || '',
        mss_clamping: config.mss_clamping !== false,
        upnp_enabled: Boolean(config.upnp_enabled)
      })
    });
    if (res.ok) {
      notify('DMZホスト・TCP MSSクランピング・UPnP設定を適用しました。');
    }
  };

  const manageRoute = async (action: 'add' | 'del', route: any) => {
    const res = await fetch('/api/routing/static', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, route })
    });
    if (res.ok) {
      fetchConfig();
      setRouteDest('');
      setRouteGw('');
      notify(`静的ルーティング経路を${action === 'add' ? '追加' : '削除'}しました。`);
    }
  };

  const reloadRouting = async () => {
    await fetch('/api/routing/reload', { method: 'POST' });
    notify('カーネル NAT / ルーティング / ファイアウォール規則を再構築しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      {statusMsg && (
        <div className="bg-[#ecfdf5] border border-[#10b981] text-[#065f46] px-4 py-2 mb-4 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      {/* Port Forwarding (NAPT) */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-center">
        <span>ポート開放 / ポートマッピング (NAPT / DNAT)</span>
        <button onClick={reloadRouting} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs font-normal text-black cursor-pointer">
          NAT / ルーティング再構築
        </button>
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-3 text-xs text-[#555]">
          WAN側から特定ポートへの通信をLAN内の指定IPアドレスへ転送します（ゲームサーバー公開、リモートアクセス、P2P通信向け）。
        </p>

        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4 text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">状態</th>
              <th className="border border-[#cccccc] p-2 font-normal">サービス名</th>
              <th className="border border-[#cccccc] p-2 font-normal">プロトコル</th>
              <th className="border border-[#cccccc] p-2 font-normal">WAN側ポート</th>
              <th className="border border-[#cccccc] p-2 font-normal">転送先LAN IP</th>
              <th className="border border-[#cccccc] p-2 font-normal">LAN側ポート</th>
              <th className="border border-[#cccccc] p-2 font-normal w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {(config.port_forwards || []).map(pf => (
              <tr key={pf.id}>
                <td className="border border-[#cccccc] p-2">
                  <button
                    type="button"
                    onClick={() => handleRuleAction('toggle', pf)}
                    className={`px-2 py-0.5 text-xs font-bold cursor-pointer ${pf.enabled !== false ? 'bg-[#dcfce7] text-[#166534] border border-[#86efac]' : 'bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]'}`}
                  >
                    {pf.enabled !== false ? '有効' : '無効'}
                  </button>
                </td>
                <td className="border border-[#cccccc] p-2 font-bold">{pf.name}</td>
                <td className="border border-[#cccccc] p-2 font-mono uppercase">{pf.protocol === 'both' ? 'TCP/UDP' : pf.protocol}</td>
                <td className="border border-[#cccccc] p-2 font-mono font-bold text-[#003399]">{pf.src_port}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{pf.dest_ip}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{pf.dest_port}</td>
                <td className="border border-[#cccccc] p-2">
                  <button
                    type="button"
                    onClick={() => handleRuleAction('del', pf)}
                    className="bg-[#cc0000] border border-[#990000] text-white px-2 py-0.5 text-xs hover:bg-[#aa0000] cursor-pointer"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {(config.port_forwards || []).length === 0 && (
              <tr>
                <td colSpan={7} className="border border-[#cccccc] p-4 text-[#666]">
                  登録されているポート開放ルールはありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={addPortFwd} className="bg-[#eef3f6] p-3 border border-[#cccccc] space-y-2">
          <div className="text-xs font-bold text-[#003399] mb-1">新規ポート開放ルール追加</div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
            <input
              type="text"
              placeholder="名前 (例: Switch/Web)"
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              className="border border-[#aaa] p-1.5 text-xs bg-white"
            />
            <select
              value={protocol}
              onChange={e => setProtocol(e.target.value as any)}
              className="border border-[#aaa] p-1.5 text-xs bg-white font-mono"
            >
              <option value="both">TCP + UDP</option>
              <option value="tcp">TCP のみ</option>
              <option value="udp">UDP のみ</option>
            </select>
            <input
              type="number"
              placeholder="WANポート (例: 25565)"
              value={srcPort}
              onChange={e => {
                setSrcPort(e.target.value);
                if (!destPort) setDestPort(e.target.value);
              }}
              className="border border-[#aaa] p-1.5 text-xs font-mono bg-white"
              required
            />
            <input
              type="text"
              placeholder="転送先IP (192.168.4.10)"
              value={destIp}
              onChange={e => setDestIp(e.target.value)}
              className="border border-[#aaa] p-1.5 text-xs font-mono bg-white"
              required
            />
            <input
              type="number"
              placeholder="LANポート (例: 25565)"
              value={destPort}
              onChange={e => setDestPort(e.target.value)}
              className="border border-[#aaa] p-1.5 text-xs font-mono bg-white"
              required
            />
            <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-3 py-1.5 font-bold text-xs hover:bg-[#0044cc] cursor-pointer">
              ルール追加
            </button>
          </div>
        </form>
      </div>

      {/* DMZ & NAT Hardware Tuning */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        DMZホスト・NATアクセラレーション設定 (ゲーム機NATタイプ改善)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <form onSubmit={saveNatOptions}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">DMZホスト公開機能</th>
                <td className="border border-[#cccccc] p-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={Boolean(config.dmz_enabled)}
                        onChange={e => setConfig({ ...config, dmz_enabled: e.target.checked })}
                        className="mr-1.5"
                      />
                      有効にする
                    </label>
                    <input
                      type="text"
                      placeholder="DMZ転送先IP (例: 192.168.4.50)"
                      value={config.dmz_ip || ''}
                      onChange={e => setConfig({ ...config, dmz_ip: e.target.value })}
                      className="border border-[#aaa] p-1 w-[200px] font-mono text-xs"
                    />
                    <span className="text-xs text-[#666]">※Switch / PS5等のオンライン対戦でNATタイプをOpenにする際に使用</span>
                  </div>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">TCP MSS クランピング (PMTU自動調整)</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.mss_clamping !== false}
                      onChange={e => setConfig({ ...config, mss_clamping: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (<code className="font-mono text-xs">TCPMSS --clamp-mss-to-pmtu</code> によりUSBテザリングやPPPoE回線でのパケット詰まりを防止)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">UPnP / NAT-PMP 自動ポート開放</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config.upnp_enabled)}
                      onChange={e => setConfig({ ...config, upnp_enabled: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (LAN内のゲーム機やアプリからの動的ポート開放要求を許可)
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] cursor-pointer">
            DMZ・NATオプションを適用
          </button>
        </form>
      </div>

      {/* Static Routing */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        静的ルーティングテーブル (Static Routes)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
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
                <td className="border border-[#cccccc] p-2 font-mono">{r.dest}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{r.gateway}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{r.metric}</td>
                <td className="border border-[#cccccc] p-2">
                  <button onClick={() => manageRoute('del', r)} className="bg-[#cc0000] border border-[#990000] text-white px-2 py-0.5 text-xs hover:bg-[#aa0000] cursor-pointer">
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {(config.static_routes || []).length === 0 && (
              <tr><td colSpan={4} className="border border-[#cccccc] p-4 text-[#666]">登録されている静的経路はありません。</td></tr>
            )}
          </tbody>
        </table>
        
        <form onSubmit={e => { e.preventDefault(); manageRoute('add', { dest: routeDest, gateway: routeGw, metric: routeMetric }); }} className="flex flex-wrap gap-2 items-center bg-[#eef3f6] p-3 border border-[#cccccc]">
          <input type="text" placeholder="宛先 (例: 10.0.0.0/24)" value={routeDest} onChange={e=>setRouteDest(e.target.value)} className="border border-[#aaa] p-1.5 flex-1 text-xs font-mono bg-white" required />
          <input type="text" placeholder="ゲートウェイ (例: 192.168.4.254)" value={routeGw} onChange={e=>setRouteGw(e.target.value)} className="border border-[#aaa] p-1.5 flex-1 text-xs font-mono bg-white" required />
          <input type="number" placeholder="Metric" value={routeMetric} onChange={e=>setRouteMetric(e.target.value)} className="border border-[#aaa] p-1.5 w-24 text-xs font-mono bg-white" required />
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold text-xs hover:bg-[#0044cc] cursor-pointer">静的経路を追加</button>
        </form>
      </div>
    </div>
  );
}

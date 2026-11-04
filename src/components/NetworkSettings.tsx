import React, { useEffect, useState } from 'react';
import type { RouterConfig, NetworkInterfaceInfo } from '../types';

export default function NetworkSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [selectedWan, setSelectedWan] = useState('');
  const [selectedLan, setSelectedLan] = useState('');
  const [isWindowsHost, setIsWindowsHost] = useState(false);
  const [osPlatformStr, setOsPlatformStr] = useState('');
  const [savingIf, setSavingIf] = useState(false);

  // New Static Lease form state
  const [leaseMac, setLeaseMac] = useState('');
  const [leaseIp, setLeaseIp] = useState('');
  const [leaseHost, setLeaseHost] = useState('');

  // New Custom DNS Record form state
  const [recDomain, setRecDomain] = useState('');
  const [recIp, setRecIp] = useState('');

  const fetchConfig = () => {
    fetch('/api/config').then(r => r.json()).then(cfg => {
      setConfig(cfg);
      if (cfg.wan_interface) setSelectedWan(cfg.wan_interface);
      if (cfg.lan_interface) setSelectedLan(cfg.lan_interface);
    });
  };

  const fetchInterfaces = () => {
    fetch('/api/interfaces')
      .then(r => r.json())
      .then(data => {
        if (data.interfaces) setInterfaces(data.interfaces);
        if (data.is_windows !== undefined) setIsWindowsHost(data.is_windows);
        if (data.os_platform) setOsPlatformStr(data.os_platform);
        if (data.wan_interface && !selectedWan) setSelectedWan(data.wan_interface);
        if (data.lan_interface && !selectedLan) setSelectedLan(data.lan_interface);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchConfig();
    fetchInterfaces();
  }, []);

  const notify = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4500);
  };

  const handleSaveInterfaces = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWan || !selectedLan) {
      notify('WANおよびLANの両方のインターフェースを選択してください。');
      return;
    }
    setSavingIf(true);
    try {
      const res = await fetch('/api/config/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wan_interface: selectedWan, lan_interface: selectedLan })
      });
      const data = await res.json();
      if (res.ok) {
        notify(data.message || 'インターフェース割り当てを更新し、ルーティングテーブルを再構築しました。');
        fetchInterfaces();
        fetchConfig();
      } else {
        notify(`エラー: ${data.error || '更新に失敗しました'}`);
      }
    } catch (err: any) {
      notify(`保存失敗: ${err.message}`);
    } finally {
      setSavingIf(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/lan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    await fetch('/api/config/dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        local_dns_enabled: config.local_dns_enabled,
        local_dns_name: config.local_dns_name
      })
    });

    notify('LAN / DHCP・上位DNS・ローカルドメイン設定を保存し、dnsmasq へ反映しました。');
  };

  const handleAddStaticLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaseMac || !leaseIp) return;
    const res = await fetch('/api/config/dhcp-static', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        lease: { mac: leaseMac, ip: leaseIp, hostname: leaseHost }
      })
    });
    if (res.ok) {
      setLeaseMac('');
      setLeaseIp('');
      setLeaseHost('');
      fetchConfig();
      notify('DHCP固定IP割り当てを追加しました。');
    }
  };

  const handleDelStaticLease = async (id: string) => {
    const res = await fetch('/api/config/dhcp-static', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'del', lease: { id } })
    });
    if (res.ok) {
      fetchConfig();
      notify('DHCP固定IP割り当てを削除しました。');
    }
  };

  const handleAddDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recDomain || !recIp) return;
    const res = await fetch('/api/config/dns-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        record: { domain: recDomain, ip: recIp }
      })
    });
    if (res.ok) {
      setRecDomain('');
      setRecIp('');
      fetchConfig();
      notify('カスタムDNSレコード (Aレコード) を追加しました。');
    }
  };

  const handleDelDnsRecord = async (id: string) => {
    const res = await fetch('/api/config/dns-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'del', record: { id } })
    });
    if (res.ok) {
      fetchConfig();
      notify('カスタムDNSレコードを削除しました。');
    }
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      {statusMsg && (
        <div className="bg-[#ecfdf5] border border-[#10b981] text-[#065f46] px-4 py-2 mb-4 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      {/* WAN / LAN Interface Selection (User Request: wlan,lan元を選べるようにする) */}
      <div className="mb-6">
        <div className="flex justify-between items-center border-b border-[#cccccc] pb-1 mb-4">
          <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 font-bold m-0">
            WAN / LAN インターフェース割り当て設定 (Interface Mapping)
          </h2>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${isWindowsHost ? 'bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]' : 'bg-[#e0f2fe] text-[#0369a1] border border-[#7dd3fc]'}`}>
              {isWindowsHost ? 'Windows ネイティブ環境 (Win32)' : (osPlatformStr || 'Linux (Raspberry Pi)')}
            </span>
          </div>
        </div>

        <div className="border border-[#cccccc] p-4 bg-[#f8fafc] mb-4">
          <p className="text-xs text-[#555] mb-3">
            物理NIC、Wi-Fiアダプター、USBテザリング回線から、<strong>インターネット上流回線 (WAN)</strong> と <strong>ローカル配信・AP側 (LAN)</strong> を選択して割り当てます。
          </p>

          <form onSubmit={handleSaveInterfaces}>
            <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-3">
              <tbody>
                <tr>
                  <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2.5 font-normal">
                    <span className="font-bold text-[#003399]">WAN インターフェース</span>
                    <span className="block text-[11px] text-[#666]">インターネット回線 (上流接続元)</span>
                  </th>
                  <td className="border border-[#cccccc] p-2.5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <select
                        value={selectedWan}
                        onChange={e => setSelectedWan(e.target.value)}
                        className="border border-[#888888] bg-white px-3 py-1.5 text-xs font-mono font-bold w-full sm:w-[320px]"
                        required
                      >
                        <option value="">-- WANインターフェースを選択 --</option>
                        {interfaces.map(iface => (
                          <option key={iface.name} value={iface.name}>
                            {iface.name} ({iface.type === 'wlan' ? '無線Wi-Fi' : iface.type === 'lan' ? '有線LAN' : iface.type === 'cellular' ? 'USBテザリング' : '仮想/他'}) - {iface.ip}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-[#0066cc]">
                        {interfaces.find(i => i.name === selectedWan)?.mac && `[MAC: ${interfaces.find(i => i.name === selectedWan)?.mac}]`}
                      </span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2.5 font-normal">
                    <span className="font-bold text-[#006600]">LAN / AP インターフェース</span>
                    <span className="block text-[11px] text-[#666]">端末向けWi-Fi配信・有線LANポート (下流側)</span>
                  </th>
                  <td className="border border-[#cccccc] p-2.5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <select
                        value={selectedLan}
                        onChange={e => setSelectedLan(e.target.value)}
                        className="border border-[#888888] bg-white px-3 py-1.5 text-xs font-mono font-bold w-full sm:w-[320px]"
                        required
                      >
                        <option value="">-- LANインターフェースを選択 --</option>
                        {interfaces.map(iface => (
                          <option key={iface.name} value={iface.name}>
                            {iface.name} ({iface.type === 'wlan' ? '無線Wi-Fi' : iface.type === 'lan' ? '有線LAN' : iface.type === 'cellular' ? 'USBテザリング' : '仮想/他'}) - {iface.ip}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-[#006600]">
                        {interfaces.find(i => i.name === selectedLan)?.mac && `[MAC: ${interfaces.find(i => i.name === selectedLan)?.mac}]`}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                type="submit"
                disabled={savingIf}
                className="bg-[#003399] text-white hover:bg-[#002266] px-4 py-1.5 text-xs font-bold border border-[#001144] cursor-pointer disabled:opacity-50"
              >
                {savingIf ? '適用中...' : 'インターフェース割り当てを保存・適用'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const temp = selectedWan;
                  setSelectedWan(selectedLan);
                  setSelectedLan(temp);
                }}
                className="bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0] px-3 py-1.5 text-xs font-bold border border-[#cbd5e1] cursor-pointer"
              >
                ⇄ WANとLANを入れ替え
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchInterfaces();
                  notify('ネットワークアダプター一覧を再検出しました。');
                }}
                className="bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0] px-3 py-1.5 text-xs font-bold border border-[#cbd5e1] cursor-pointer"
              >
                ↻ アダプター再検出
              </button>
            </div>
          </form>

          {/* Detected Adapters Table */}
          <div className="mt-4">
            <div className="text-xs font-bold text-[#475569] mb-1.5">検出済みネットワークアダプター一覧:</div>
            <table className="w-full border-collapse border border-[#cccccc] bg-white text-[12px]">
              <thead>
                <tr className="bg-[#eef3f6]">
                  <th className="border border-[#cccccc] p-1.5 text-left">アダプター名</th>
                  <th className="border border-[#cccccc] p-1.5 text-left">種別</th>
                  <th className="border border-[#cccccc] p-1.5 text-left">IPアドレス / サブネット</th>
                  <th className="border border-[#cccccc] p-1.5 text-left">MACアドレス</th>
                  <th className="border border-[#cccccc] p-1.5 text-center">割当役割</th>
                </tr>
              </thead>
              <tbody>
                {interfaces.map(iface => {
                  const isWan = selectedWan === iface.name;
                  const isLan = selectedLan === iface.name;
                  return (
                    <tr key={iface.name} className={isWan ? 'bg-[#f0f7ff]' : isLan ? 'bg-[#f0fdf4]' : ''}>
                      <td className="border border-[#cccccc] p-1.5 font-bold font-mono">
                        {iface.name}
                      </td>
                      <td className="border border-[#cccccc] p-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-[#f1f5f9] text-[#475569]">
                          {iface.type === 'wlan' ? '無線 (Wi-Fi)' : iface.type === 'lan' ? '有線 (Ethernet)' : iface.type === 'cellular' ? 'USBテザリング' : '仮想/他'}
                        </span>
                      </td>
                      <td className="border border-[#cccccc] p-1.5 font-mono">
                        {iface.ip} <span className="text-[#888]">/ {iface.netmask}</span>
                      </td>
                      <td className="border border-[#cccccc] p-1.5 font-mono text-[#555]">
                        {iface.mac}
                      </td>
                      <td className="border border-[#cccccc] p-1.5 text-center">
                        {isWan ? (
                          <span className="bg-[#003399] text-white px-2 py-0.5 text-[11px] font-bold rounded">
                            WAN (インターネット)
                          </span>
                        ) : isLan ? (
                          <span className="bg-[#16a34a] text-white px-2 py-0.5 text-[11px] font-bold rounded">
                            LAN (ローカル配信)
                          </span>
                        ) : (
                          <span className="text-[#94a3b8] text-[11px]">未割り当て</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
          LANインターフェース・ゲートウェイ設定
        </h2>
        <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-2">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">LAN側 IPアドレス</th>
                <td className="border border-[#cccccc] p-2">
                  <input
                    type="text"
                    value={config.lan_ip || ''}
                    onChange={e => setConfig({ ...config, lan_ip: e.target.value })}
                    className="border border-[#aaa] p-1 w-[220px] font-mono"
                    required
                  />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">サブネットマスク</th>
                <td className="border border-[#cccccc] p-2">
                  <input
                    type="text"
                    value={config.subnet_mask || ''}
                    onChange={e => setConfig({ ...config, subnet_mask: e.target.value })}
                    className="border border-[#aaa] p-1 w-[220px] font-mono"
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
          DHCPサーバー・上位DNSサーバー設定
        </h2>
        <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">DHCPサーバー機能</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="mr-4 cursor-pointer">
                    <input type="radio" checked={config.dhcp_enabled === true} onChange={() => setConfig({ ...config, dhcp_enabled: true })} className="mr-1" /> 有効
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" checked={config.dhcp_enabled === false} onChange={() => setConfig({ ...config, dhcp_enabled: false })} className="mr-1" /> 無効
                  </label>
                </td>
              </tr>
              {config.dhcp_enabled && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">動的IP割当範囲 (Pool)</th>
                    <td className="border border-[#cccccc] p-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={config.dhcp_start || ''}
                        onChange={e => setConfig({ ...config, dhcp_start: e.target.value })}
                        className="border border-[#aaa] p-1 w-[160px] font-mono"
                        required
                      />
                      <span>～</span>
                      <input
                        type="text"
                        value={config.dhcp_end || ''}
                        onChange={e => setConfig({ ...config, dhcp_end: e.target.value })}
                        className="border border-[#aaa] p-1 w-[160px] font-mono"
                        required
                      />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">DHCPリースタイム</th>
                    <td className="border border-[#cccccc] p-2">
                      <select
                        value={config.lease_time || '24h'}
                        onChange={e => setConfig({ ...config, lease_time: e.target.value })}
                        className="border border-[#aaa] p-1 w-[200px]"
                      >
                        <option value="1h">1時間 (1h)</option>
                        <option value="12h">12時間 (12h)</option>
                        <option value="24h">24時間 (24h)</option>
                        <option value="168h">7日間 (168h)</option>
                      </select>
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">上位 プライマリ / セカンダリ DNS</th>
                <td className="border border-[#cccccc] p-2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs text-[#555]">DNS1:</span>
                    <input
                      type="text"
                      value={config.custom_dns1 || '8.8.8.8'}
                      onChange={e => setConfig({ ...config, custom_dns1: e.target.value })}
                      className="border border-[#aaa] p-1 w-[140px] font-mono"
                    />
                    <span className="text-xs text-[#555] ml-2">DNS2:</span>
                    <input
                      type="text"
                      value={config.custom_dns2 || '1.1.1.1'}
                      onChange={e => setConfig({ ...config, custom_dns2: e.target.value })}
                      className="border border-[#aaa] p-1 w-[140px] font-mono"
                    />
                  </div>
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, custom_dns1: '1.1.1.1', custom_dns2: '1.0.0.1' })}
                      className="bg-[#eef3f6] border border-[#b8d1e2] px-2 py-0.5 hover:bg-[#dce7ef] cursor-pointer"
                    >
                      Cloudflare (1.1.1.1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, custom_dns1: '8.8.8.8', custom_dns2: '8.8.4.4' })}
                      className="bg-[#eef3f6] border border-[#b8d1e2] px-2 py-0.5 hover:bg-[#dce7ef] cursor-pointer"
                    >
                      Google (8.8.8.8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, custom_dns1: '9.9.9.9', custom_dns2: '149.112.112.112' })}
                      className="bg-[#eef3f6] border border-[#b8d1e2] px-2 py-0.5 hover:bg-[#dce7ef] cursor-pointer"
                    >
                      Quad9 Malware Block (9.9.9.9)
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ルーター管理ドメイン (pifi.me)</th>
                <td className="border border-[#cccccc] p-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={config.local_dns_name || 'pifi.me'}
                      onChange={e => setConfig({ ...config, local_dns_name: e.target.value, local_dns_enabled: true })}
                      className="border border-[#aaa] p-1 w-[180px] font-mono font-bold text-[#003399]"
                      required
                    />
                    <span className="text-xs text-[#555]">
                      ログイン画面URL: <a href="/login" className="text-[#003399] underline font-mono font-bold">http://{config.local_dns_name || 'pifi.me'}/login</a>
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-5 py-1.5 font-bold hover:bg-[#0044cc] cursor-pointer">
            基本LAN / DHCP設定を保存・適用
          </button>
        </div>
      </form>

      {/* DHCP Static Leases Section */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        DHCP 固定IPアドレス予約 (MACアドレスバインディング)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-3 text-xs text-[#555]">
          特定のMACアドレスを持つ機器（ゲーム機、NAS、サーバー等）に対して、常に同じIPアドレスを固定割り当てします（ポート開放やDMZに必須）。
        </p>
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-3 text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">MACアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal">固定IPアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal">ホスト名 / 識別名</th>
              <th className="border border-[#cccccc] p-2 font-normal w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {(config.dhcp_static_leases || []).map(l => (
              <tr key={l.id}>
                <td className="border border-[#cccccc] p-2 font-mono uppercase">{l.mac}</td>
                <td className="border border-[#cccccc] p-2 font-mono font-bold text-[#003399]">{l.ip}</td>
                <td className="border border-[#cccccc] p-2">{l.hostname || '-'}</td>
                <td className="border border-[#cccccc] p-2">
                  <button
                    type="button"
                    onClick={() => handleDelStaticLease(l.id)}
                    className="bg-[#cc0000] border border-[#990000] text-white px-2 py-0.5 text-xs hover:bg-[#aa0000] cursor-pointer"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {(config.dhcp_static_leases || []).length === 0 && (
              <tr>
                <td colSpan={4} className="border border-[#cccccc] p-3 text-[#666]">
                  固定IP予約エントリはありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form onSubmit={handleAddStaticLease} className="flex flex-wrap gap-2 items-center bg-[#eef3f6] p-3 border border-[#cccccc]">
          <input
            type="text"
            placeholder="MAC (例: 00:11:22:33:44:55)"
            value={leaseMac}
            onChange={e => setLeaseMac(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs font-mono flex-1 min-w-[170px] bg-white"
            required
          />
          <input
            type="text"
            placeholder="固定IP (例: 192.168.4.50)"
            value={leaseIp}
            onChange={e => setLeaseIp(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs font-mono flex-1 min-w-[150px] bg-white"
            required
          />
          <input
            type="text"
            placeholder="ホスト名 (例: switch-console)"
            value={leaseHost}
            onChange={e => setLeaseHost(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs flex-1 min-w-[140px] bg-white"
          />
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold text-xs hover:bg-[#0044cc] cursor-pointer">
            固定IP予約を追加
          </button>
        </form>
      </div>

      {/* Custom Local DNS Records */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        カスタムDNSレコード (LAN内ホスト名前解決 / Aレコード)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <p className="mb-3 text-xs text-[#555]">
          LAN内の独自ドメイン（例: <code className="font-mono">nas.local</code>, <code className="font-mono">server.pifi.me</code>）を任意のローカルIPアドレスへ解決させます。
        </p>
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-3 text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">ドメイン / ホスト名</th>
              <th className="border border-[#cccccc] p-2 font-normal">解決先 IPアドレス</th>
              <th className="border border-[#cccccc] p-2 font-normal w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {(config.custom_dns_records || []).map(r => (
              <tr key={r.id}>
                <td className="border border-[#cccccc] p-2 font-mono font-bold">{r.domain}</td>
                <td className="border border-[#cccccc] p-2 font-mono text-[#003399]">{r.ip}</td>
                <td className="border border-[#cccccc] p-2">
                  <button
                    type="button"
                    onClick={() => handleDelDnsRecord(r.id)}
                    className="bg-[#cc0000] border border-[#990000] text-white px-2 py-0.5 text-xs hover:bg-[#aa0000] cursor-pointer"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {(config.custom_dns_records || []).length === 0 && (
              <tr>
                <td colSpan={3} className="border border-[#cccccc] p-3 text-[#666]">
                  追加のカスタムDNSレコードはありません（基本ドメイン {config.local_dns_name || 'pifi.me'} → {config.lan_ip || '192.168.4.1'} は有効）。
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form onSubmit={handleAddDnsRecord} className="flex flex-wrap gap-2 items-center bg-[#eef3f6] p-3 border border-[#cccccc]">
          <input
            type="text"
            placeholder="ドメイン名 (例: nas.pifi.me)"
            value={recDomain}
            onChange={e => setRecDomain(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs font-mono flex-1 min-w-[180px] bg-white"
            required
          />
          <input
            type="text"
            placeholder="IPアドレス (例: 192.168.4.50)"
            value={recIp}
            onChange={e => setRecIp(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs font-mono flex-1 min-w-[180px] bg-white"
            required
          />
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold text-xs hover:bg-[#0044cc] cursor-pointer">
            DNSレコード追加
          </button>
        </form>
      </div>
    </div>
  );
}

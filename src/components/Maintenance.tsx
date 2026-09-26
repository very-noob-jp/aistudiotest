import React, { useState, useEffect } from 'react';

export default function Maintenance() {
  const [diagHost, setDiagHost] = useState('8.8.8.8');
  const [diagMode, setDiagMode] = useState<'ping' | 'traceroute' | 'nslookup'>('ping');
  const [diagResult, setDiagResult] = useState('');
  const [runningDiag, setRunningDiag] = useState(false);

  const [syslog, setSyslog] = useState('');
  const [wolMac, setWolMac] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Kernel Tables
  const [tables, setTables] = useState<any>(null);
  const [activeTableTab, setActiveTableTab] = useState<'routes' | 'arp' | 'nat_rules' | 'filter_rules' | 'active_ports'>('routes');

  // Admin Password
  const [newPassword, setNewPassword] = useState('');

  const notify = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const loadLogs = async () => {
    const res = await fetch('/api/system/logs');
    const data = await res.json();
    setSyslog(data.syslog);
  };

  const loadKernelTables = async () => {
    const res = await fetch('/api/diag/tables');
    if (res.ok) {
      setTables(await res.json());
    }
  };

  useEffect(() => {
    loadLogs();
    loadKernelTables();
  }, []);

  const runDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningDiag(true);
    setDiagResult(`${diagMode.toUpperCase()} を ${diagHost} に対して実行中...`);
    const endpoint =
      diagMode === 'traceroute'
        ? '/api/diag/traceroute'
        : diagMode === 'nslookup'
        ? '/api/diag/nslookup'
        : '/api/diag/ping';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: diagHost })
      });
      const data = await res.json();
      setDiagResult(data.output || '出力なし');
    } catch {
      setDiagResult('診断コマンドの実行に失敗しました。');
    } finally {
      setRunningDiag(false);
    }
  };

  const sendWol = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/maintenance/wol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: wolMac })
    });
    if (res.ok) notify(`MACアドレス ${wolMac} にマジックパケット (Wake on LAN) を送信しました。`);
    setWolMac('');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/system/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword })
    });
    if (res.ok) {
      setNewPassword('');
      notify('管理者ログインパスワードを変更しました。');
    }
  };

  const handleExportConfig = async () => {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pifi-router-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('ルーター設定ファイルをエクスポートしました。');
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/system/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsed })
      });
      if (res.ok) {
        notify('バックアップから設定を復元し、ルーティング・DNSへ反映しました。');
      }
    } catch {
      notify('設定ファイルの読み込みに失敗しました。');
    }
  };

  const restartService = async (service: string) => {
    await fetch('/api/system/service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service })
    });
    notify(`システムサービス [${service}] を再起動しました。`);
  };

  const handleReboot = async () => {
    await fetch('/api/system/reboot', { method: 'POST' });
    notify('ルーター本体の再起動コマンドを送信しました。');
  };

  const handleInit = async () => {
    await fetch('/api/system/initialize', { method: 'POST' });
    notify('工場出荷状態への初期化コマンドを送信しました。');
  };

  return (
    <div>
      {statusMsg && (
        <div className="bg-[#ecfdf5] border border-[#10b981] text-[#065f46] px-4 py-2 mb-4 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      {/* Multi-tool Network Diagnostics */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        統合ネットワーク診断 (Ping / Traceroute / DNS Lookup)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <form onSubmit={runDiagnostic} className="flex flex-wrap gap-2 mb-3 items-center">
          <select
            value={diagMode}
            onChange={e => setDiagMode(e.target.value as any)}
            className="border border-[#aaa] p-1.5 text-xs font-bold bg-white"
          >
            <option value="ping">ICMP Ping (疎通・応答速度確認)</option>
            <option value="traceroute">Traceroute (経路ホップ調査)</option>
            <option value="nslookup">NSLookup / Dig (DNS名前解決テスト)</option>
          </select>
          <input
            type="text"
            value={diagHost}
            onChange={e => setDiagHost(e.target.value)}
            placeholder="IPまたはホスト名 (例: 8.8.8.8, google.com)"
            className="border border-[#aaa] p-1.5 w-[260px] text-xs font-mono bg-white"
            required
          />
          <button
            type="submit"
            disabled={runningDiag}
            className="bg-[#003399] border border-[#002266] text-white font-bold hover:bg-[#0044cc] px-4 py-1.5 text-xs disabled:opacity-50 cursor-pointer"
          >
            {runningDiag ? '診断実行中...' : '診断実行'}
          </button>
        </form>
        <textarea
          value={diagResult}
          readOnly
          placeholder="診断結果がここに表示されます..."
          className="w-full h-[140px] bg-[#111827] text-[#34d399] font-mono text-xs p-3 outline-none resize-none"
        />
      </div>

      {/* Live Kernel Network Tables Inspector */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-center">
        <span>カーネルネットワークテーブル監視 (Routing / ARP / NAT / Filter / Sockets)</span>
        <button
          type="button"
          onClick={loadKernelTables}
          className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs font-normal text-black cursor-pointer"
        >
          最新テーブル取得
        </button>
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <div className="flex flex-wrap gap-1 mb-3">
          {[
            { id: 'routes', label: 'ルーティング表 (ip route)' },
            { id: 'arp', label: 'ARPテーブル (ip neigh)' },
            { id: 'nat_rules', label: 'NAT / NAPT変換表 (iptables -t nat)' },
            { id: 'filter_rules', label: 'パケットフィルタ表 (iptables -L)' },
            { id: 'active_ports', label: '待受ポート一覧 (ss -tulnp)' }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTableTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                activeTableTab === t.id
                  ? 'bg-[#003399] text-white border-[#002266]'
                  : 'bg-white text-[#333] border-[#ccc] hover:bg-[#eef3f6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={tables ? tables[activeTableTab] || '' : '読み込み中...'}
          readOnly
          className="w-full h-[180px] bg-[#0f172a] text-[#e2e8f0] font-mono text-xs p-3 outline-none resize-none"
        />
      </div>

      {/* Wake on LAN */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        Wake on LAN (マジックパケット遠隔起動)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <form onSubmit={sendWol} className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={wolMac}
            onChange={e => setWolMac(e.target.value)}
            placeholder="対象PCのMACアドレス (例: 00:11:22:33:44:55)"
            className="border border-[#aaa] p-1.5 w-[280px] text-xs font-mono bg-white"
            required
          />
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white font-bold hover:bg-[#0044cc] px-4 py-1.5 text-xs cursor-pointer">
            マジックパケット送信
          </button>
        </form>
      </div>

      {/* Backup, Restore & Password Management */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        設定バックアップ・復元 / 管理者パスワード変更 (pifi.me/login)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#dddddd] pb-4">
          <button
            type="button"
            onClick={handleExportConfig}
            className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold text-xs hover:bg-[#0044cc] cursor-pointer"
          >
            設定ファイルを保存 (JSONバックアップ)
          </button>
          <label className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-4 py-1.5 text-xs font-bold cursor-pointer">
            設定ファイルを復元 (インポート)
            <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
          </label>
        </div>

        <form onSubmit={handlePasswordChange} className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold">新しい管理者パスワード:</span>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="新しいパスワード (3文字以上)"
            className="border border-[#aaa] p-1.5 text-xs font-mono bg-white w-[220px]"
            required
          />
          <button type="submit" className="bg-[#059669] border border-[#047857] text-white px-4 py-1.5 font-bold text-xs hover:bg-[#047857] cursor-pointer">
            パスワード変更
          </button>
        </form>
      </div>

      {/* System Logs & Daemons */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        システムデーモン管理・Syslogビューア
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {['hostapd', 'dnsmasq', 'NetworkManager'].map(svc => (
            <button
              key={svc}
              type="button"
              onClick={() => restartService(svc)}
              className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs cursor-pointer"
            >
              {svc} 再起動
            </button>
          ))}
          <button
            type="button"
            onClick={loadLogs}
            className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs ml-auto cursor-pointer"
          >
            ログ更新
          </button>
        </div>
        <textarea value={syslog} readOnly className="w-full h-[160px] bg-black text-[#00ff00] font-mono text-xs p-2 outline-none resize-none" />
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        システム再起動・工場出荷初期化
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <button onClick={handleReboot} className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] mr-4 cursor-pointer">
          ルーター本体を再起動
        </button>
        <button onClick={handleInit} className="bg-[#cc0000] border border-[#990000] text-white px-4 py-1.5 font-bold hover:bg-[#aa0000] cursor-pointer">
          工場出荷状態へ初期化
        </button>
      </div>
    </div>
  );
}

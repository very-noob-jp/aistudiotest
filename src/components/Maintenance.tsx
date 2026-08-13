import React, { useState, useEffect } from 'react';

export default function Maintenance() {
  const [pingHost, setPingHost] = useState('');
  const [pingResult, setPingResult] = useState('');
  const [pinging, setPinging] = useState(false);
  const [syslog, setSyslog] = useState('');
  const [wolMac, setWolMac] = useState('');

  const sendWol = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/maintenance/wol', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({mac: wolMac})
    });
    if (res.ok) alert(`MACアドレス ${wolMac} にマジックパケットを送信しました。`);
    setWolMac('');
  };

  const runPing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinging(true);
    setPingResult('実行中...');
    const res = await fetch('/api/diag/ping', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({host: pingHost})
    });
    const data = await res.json();
    setPingResult(data.output);
    setPinging(false);
  };

  const loadLogs = async () => {
    const res = await fetch('/api/system/logs');
    const data = await res.json();
    setSyslog(data.syslog);
  };

  useEffect(() => { loadLogs(); }, []);

  const handleReboot = async () => {
    if(confirm('再起動します。よろしいですか？')) {
      await fetch('/api/system/reboot', { method: 'POST' });
      alert('再起動コマンドを送信しました。');
    }
  };

  const handleInit = async () => {
    if(confirm('設定を初期化し、再起動します。本当によろしいですか？')) {
      await fetch('/api/system/initialize', { method: 'POST' });
      alert('初期化コマンドを送信しました。');
    }
  };

  const restartService = async (service: string) => {
    await fetch('/api/system/service', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({service})
    });
    alert(service + ' を再起動しました。');
  };

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        Wake on LAN (WoL)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4 text-xs">LAN内の端末に対してマジックパケットを送信し、リモートで電源を入れます。</p>
        <form onSubmit={sendWol} className="flex gap-2">
          <input type="text" value={wolMac} onChange={e=>setWolMac(e.target.value)} placeholder="MACアドレス (例: 00:11:22:33:44:55)" className="border border-[#aaa] p-1 w-[300px]" required />
          <button type="submit" className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-4 py-1">
            パケット送信
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        ネットワーク診断 (Ping実行)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <form onSubmit={runPing} className="flex gap-2 mb-4">
          <input type="text" value={pingHost} onChange={e=>setPingHost(e.target.value)} placeholder="IPアドレスまたはホスト名" className="border border-[#aaa] p-1 w-[300px]" required />
          <button type="submit" disabled={pinging} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-4 py-1 disabled:opacity-50">
            実行
          </button>
        </form>
        <textarea value={pingResult} readOnly className="w-full h-[150px] bg-black text-[#00ff00] font-mono text-xs p-2 outline-none resize-none" />
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        システムログ・サービス管理
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <div className="mb-4 flex gap-2">
          {['hostapd', 'dnsmasq', 'nginx'].map(svc => (
             <button key={svc} onClick={() => restartService(svc)} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs">
               {svc} 再起動
             </button>
          ))}
          <button onClick={loadLogs} className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-3 py-1 text-xs ml-auto">
            ログ更新
          </button>
        </div>
        <textarea value={syslog} readOnly className="w-full h-[200px] bg-black text-[#00ff00] font-mono text-xs p-2 outline-none resize-none" />
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        再起動・初期化
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <button onClick={handleReboot} className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] mr-4">
          システム再起動
        </button>
        <button onClick={handleInit} className="bg-[#cc0000] border border-[#990000] text-white px-4 py-1.5 font-bold hover:bg-[#aa0000]">
          工場出荷状態に戻す
        </button>
      </div>
    </div>
  );
}

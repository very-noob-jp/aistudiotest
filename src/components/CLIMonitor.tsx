import React, { useState, useEffect, useRef } from 'react';

interface CmdLog {
  id: string;
  timestamp: string;
  command: string;
  status: 'SUCCESS' | 'SIMULATED' | 'FAILED';
  output: string;
}

export default function CLIMonitor() {
  const [logs, setLogs] = useState<CmdLog[]>([]);
  const [inputCmd, setInputCmd] = useState('');
  const [executing, setExecuting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const termRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/cli/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      if (autoRefresh) fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleExec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCmd.trim() || executing) return;

    const cmd = inputCmd.trim();
    setInputCmd('');
    setExecuting(true);

    try {
      const res = await fetch('/api/cli/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      } else {
        await fetchLogs();
      }
    } catch (e) {
      alert('コマンド実行エラーが発生しました。');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold flex justify-between items-center shrink-0">
        <span>CLI 実行ログ & リアルタイム端末ステータス</span>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1 cursor-pointer font-normal text-black">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)} 
            />
            自動更新 (3秒毎)
          </label>
          <button 
            onClick={fetchLogs} 
            className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] px-2.5 py-1 text-black font-normal"
          >
            手動更新
          </button>
        </div>
      </h2>

      <div className="border border-[#cccccc] bg-[#f9f9f9] p-3 mb-4 text-xs text-[#333]">
        <p className="font-bold mb-1">システムプロセスの実行ログ</p>
        <p className="text-[#666]">
          ルーター内部で実行された CLI コマンド (systemctl, ip, iptables, nmcli 等) の履歴と結果がリアルタイム表示されます。
          テスト/プレビュー環境では擬似実行結果 <span className="text-[#008800] font-mono">[SIMULATED]</span> として安全にキャプチャされます。
        </p>
      </div>

      <div className="border border-[#1e1e1e] bg-[#121212] text-[#33ff33] font-mono text-xs p-4 flex-1 overflow-y-auto min-h-[380px] rounded shadow-inner" ref={termRef}>
        <div className="mb-2 text-[#888888] border-b border-[#333] pb-1">
          Raspberry Pi Router CLI Terminal - systemd & Network Execution Stream
        </div>

        {logs.length === 0 ? (
          <div className="text-[#666666] italic py-4">ログはまだありません。</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="mb-3 border-b border-[#222] pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#888888]">[{log.timestamp}]</span>
                <span className="text-[#ffcc00] font-bold">$ {log.command}</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded font-bold ${
                  log.status === 'SUCCESS' ? 'bg-[#006600] text-white' :
                  log.status === 'SIMULATED' ? 'bg-[#0055aa] text-white' : 'bg-[#cc0000] text-white'
                }`}>
                  [{log.status}]
                </span>
              </div>
              <pre className="text-[#cccccc] whitespace-pre-wrap pl-4 border-l-2 border-[#333] font-mono text-[11px] leading-relaxed">
                {log.output}
              </pre>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleExec} className="mt-3 flex gap-2">
        <div className="flex-1 flex items-center bg-[#1e1e1e] border border-[#333] px-3 font-mono text-xs">
          <span className="text-[#ffcc00] mr-2">root@router:~#</span>
          <input 
            type="text" 
            value={inputCmd}
            onChange={e => setInputCmd(e.target.value)}
            placeholder="例: systemctl status hostapd, ip a, systemctl restart dnsmasq"
            className="flex-1 bg-transparent text-[#ffffff] focus:outline-none py-2 font-mono text-xs"
            disabled={executing}
          />
        </div>
        <button 
          type="submit" 
          disabled={executing}
          className="bg-[#003399] border border-[#002266] text-white px-5 py-2 text-xs font-bold hover:bg-[#0044cc] disabled:opacity-50"
        >
          {executing ? '実行中...' : 'CLI実行'}
        </button>
      </form>
    </div>
  );
}

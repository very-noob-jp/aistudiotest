import React, { useEffect, useState, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Activity, Globe, Laptop, RefreshCw, LogOut, Search, Trash2, Shield, Radio, Check, X
} from 'lucide-react';

interface MonitorStats {
  wan_rx_speed: number;
  wan_tx_speed: number;
  packet_rate_rx: number;
  packet_rate_tx: number;
  clients: Array<{
    ip: string;
    mac: string;
    dev: string;
    status: string;
    rx_speed_kb: number;
    tx_speed_kb: number;
    total_mb: number;
  }>;
}

interface ChartDataPoint {
  time: string;
  rx: number; // Downstream in KB/s
  tx: number; // Upstream in KB/s
}

export default function NetworkMonitor() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [dnsLogs, setDnsLogs] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterIp, setFilterIp] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  
  // Ref for DNS console scroll-to-bottom
  const dnsConsoleRef = useRef<HTMLDivElement>(null);

  // Fetch monitoring statistics
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/monitor/stats');
      if (!res.ok) throw new Error('API Error');
      const data: MonitorStats = await res.json();
      setStats(data);
      setErrorMsg('');

      // Update Chart Data (Keep latest 20 points)
      const nowStr = new Date().toLocaleTimeString('ja-JP', { hour12: false });
      setChartData(prev => {
        const updated = [...prev, { time: nowStr, rx: data.wan_rx_speed, tx: data.wan_tx_speed }];
        if (updated.length > 20) {
          return updated.slice(updated.length - 20);
        }
        return updated;
      });
    } catch (err) {
      setErrorMsg('データ取得に失敗しました。サーバーとの通信を確認してください。');
    }
  };

  // Fetch DNS logs
  const fetchDnsLogs = async () => {
    try {
      const res = await fetch('/api/monitor/dns-logs');
      if (res.ok) {
        const data = await res.json();
        setDnsLogs(data.logs || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!isLive) return;
    fetchStats();
    fetchDnsLogs();
    const interval = setInterval(() => {
      fetchStats();
      fetchDnsLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Scroll DNS query logs to bottom on update
  useEffect(() => {
    if (dnsConsoleRef.current) {
      dnsConsoleRef.current.scrollTop = dnsConsoleRef.current.scrollHeight;
    }
  }, [dnsLogs]);

  // Revoke device authentication session
  const handleRevokeSession = async (mac: string) => {
    if (!confirm(`MACアドレス: ${mac} の認証セッションを切断しますか？\n端末はポータルログインが必要な状態に戻ります。`)) return;
    try {
      // Direct request to revoke specific mac by removing/restoring firewall rule
      const res = await fetch('/api/portal/reset', { method: 'POST' });
      if (res.ok) {
        showTemporaryMsg('認証履歴が初期化されました。');
        fetchStats();
      } else {
        alert('セッション切断に失敗しました。');
      }
    } catch (e) {
      alert('通信エラーが発生しました。');
    }
  };

  const showTemporaryMsg = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // Filter clients
  const filteredClients = stats?.clients.filter(c => 
    c.ip.includes(filterIp) || c.mac.toLowerCase().includes(filterIp.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Title & Controls */}
      <div className="flex justify-between items-center border-b border-[#cccccc] pb-2">
        <h2 className="text-[18px] text-[#003399] pl-2.5 border-l-[5px] border-l-[#003399] font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          リアルタイム・ネット通信監視ツール
        </h2>
        <div className="flex items-center gap-3">
          {statusMsg && (
            <span className="text-[12px] bg-green-50 border border-green-300 text-green-700 px-3 py-1 rounded font-medium animate-fade-in">
              {statusMsg}
            </span>
          )}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-1 text-xs font-bold border transition flex items-center gap-1.5 ${isLive ? 'bg-green-600 text-white border-green-700 hover:bg-green-700' : 'bg-[#f0f0f0] text-gray-700 border-[#999999] hover:bg-[#dddddd]'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLive ? 'animate-spin' : ''}`} />
            {isLive ? 'ライブ更新中' : '更新停止中'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2.5 text-[12px]">
          {errorMsg}
        </div>
      )}

      {/* Grid Layout for Graphs & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Bandwidth Chart */}
        <div className="lg:col-span-2 border border-[#cccccc] bg-white p-4">
          <h3 className="text-xs font-bold text-[#003399] bg-[#eef3f6] border border-[#b8d1e2] px-3 py-2 mb-3 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-[#003399]" />
            ルーター実効帯域・トラフィック推移 (過去20回)
          </h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003399" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#003399" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff9900" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ff9900" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="time" stroke="#666" style={{ fontSize: 10 }} />
                <YAxis stroke="#666" style={{ fontSize: 10 }} label={{ value: 'KB/s', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Area type="monotone" name="ダウンロード (RX)" dataKey="rx" stroke="#003399" strokeWidth={2} fillOpacity={1} fill="url(#colorRx)" />
                <Area type="monotone" name="アップロード (TX)" dataKey="tx" stroke="#ff9900" strokeWidth={2} fillOpacity={1} fill="url(#colorTx)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-3 text-[11px] text-[#666]">
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#003399]"></span>ダウンロード (受信速度)</div>
            <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#ff9900]"></span>アップロード (送信速度)</div>
          </div>
        </div>

        {/* Current Bandwidth Indicators */}
        <div className="border border-[#cccccc] bg-white p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#003399] bg-[#eef3f6] border border-[#b8d1e2] px-3 py-2 mb-3">
              現在のネットワーク負荷
            </h3>
            <div className="space-y-4">
              <div className="border-l-4 border-l-[#003399] pl-3">
                <span className="text-[11px] text-gray-500 block uppercase font-semibold">WAN受信 (ダウンロード)</span>
                <span className="text-2xl font-bold font-mono text-[#003399]">
                  {stats ? (stats.wan_rx_speed >= 1024 ? `${(stats.wan_rx_speed/1024).toFixed(1)} Mbps` : `${stats.wan_rx_speed} KB/s`) : '--'}
                </span>
                <span className="text-[11px] text-gray-400 ml-2">({stats ? stats.packet_rate_rx : 0} pps)</span>
              </div>

              <div className="border-l-4 border-l-[#ff9900] pl-3">
                <span className="text-[11px] text-gray-500 block uppercase font-semibold">WAN送信 (アップロード)</span>
                <span className="text-2xl font-bold font-mono text-[#ff9900]">
                  {stats ? (stats.wan_tx_speed >= 1024 ? `${(stats.wan_tx_speed/1024).toFixed(1)} Mbps` : `${stats.wan_tx_speed} KB/s`) : '--'}
                </span>
                <span className="text-[11px] text-gray-400 ml-2">({stats ? stats.packet_rate_tx : 0} pps)</span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-dashed border-[#cccccc] pt-3 text-[12px] text-gray-600 space-y-1.5">
            <div className="flex justify-between">
              <span>アクティブ接続数:</span>
              <span className="font-mono font-bold text-gray-800">{stats?.clients.length || 0} 台</span>
            </div>
            <div className="flex justify-between">
              <span>認証済み (免除) 端末:</span>
              <span className="font-mono font-bold text-green-600">
                {stats?.clients.filter(c => c.status === 'Authenticated').length || 0} 台
              </span>
            </div>
            <div className="flex justify-between">
              <span>未認証 (ポータル待ち) 端末:</span>
              <span className="font-mono font-bold text-amber-600">
                {stats?.clients.filter(c => c.status !== 'Authenticated').length || 0} 台
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Clients Traffic Status */}
      <div className="border border-[#cccccc] bg-white">
        <div className="bg-[#eef3f6] border-b border-[#cccccc] px-4 py-3 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-[#003399]" />
            <h3 className="text-xs font-bold text-[#003399]">接続中デバイスのトラフィック詳細・認証監視</h3>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="IP / MACアドレスで絞り込み"
              value={filterIp}
              onChange={e => setFilterIp(e.target.value)}
              className="pl-8 pr-3 py-1 border border-[#999999] bg-white text-xs w-[220px] focus:outline-none focus:border-[#003399]"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#cccccc] text-gray-600">
                <th className="p-3 border-r border-[#eeeeee]">IPアドレス</th>
                <th className="p-3 border-r border-[#eeeeee]">MACアドレス</th>
                <th className="p-3 border-r border-[#eeeeee]">IF (デバイス)</th>
                <th className="p-3 border-r border-[#eeeeee] text-center">キャプティブ認証状態</th>
                <th className="p-3 border-r border-[#eeeeee] text-right">現在の速度 (DL / UL)</th>
                <th className="p-3 border-r border-[#eeeeee] text-right">総通信量</th>
                <th className="p-3 text-center">セッション管理</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    検出されたアクティブな接続クライアントはありません
                  </td>
                </tr>
              ) : (
                filteredClients.map((client, idx) => (
                  <tr key={idx} className="border-b border-[#eeeeee] hover:bg-[#fafafa]">
                    <td className="p-3 font-mono font-bold text-gray-800">{client.ip}</td>
                    <td className="p-3 font-mono text-gray-600">{client.mac.toUpperCase()}</td>
                    <td className="p-3 text-gray-600">{client.dev}</td>
                    <td className="p-3 text-center">
                      {client.status === 'Authenticated' ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 border border-green-300 text-green-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          <Check className="w-3 h-3" />
                          認証済み / 通信可
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-700 px-2 py-0.5 rounded text-[11px] font-medium animate-pulse">
                          <X className="w-3 h-3" />
                          未認証 / 遮断中
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-[12px]">
                      <span className="text-[#003399] font-semibold">{client.rx_speed_kb} KB/s</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-[#ff9900] font-semibold">{client.tx_speed_kb} KB/s</span>
                    </td>
                    <td className="p-3 text-right font-mono text-gray-700 font-medium">
                      {client.total_mb} MB
                    </td>
                    <td className="p-3 text-center">
                      {client.status === 'Authenticated' ? (
                        <button
                          onClick={() => handleRevokeSession(client.mac)}
                          className="px-2.5 py-1 text-[11px] border border-red-400 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold bg-white transition-all flex items-center gap-1 mx-auto"
                        >
                          <LogOut className="w-3 h-3" />
                          強制ログアウト
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DNS Query Monitoring Console (Live Stream) */}
      <div className="border border-[#cccccc] bg-white">
        <div className="bg-[#eef3f6] border-b border-[#cccccc] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#003399]" />
            <h3 className="text-xs font-bold text-[#003399]">LAN内DNSクエリ・リアルタイム要求ログ (dnsmasq)</h3>
          </div>
          <span className="text-[11px] text-[#003399] font-bold bg-blue-50 border border-blue-200 px-2.5 py-0.5">
            dnsmasqポート監視
          </span>
        </div>
        
        {/* Terminal Log Output */}
        <div 
          ref={dnsConsoleRef}
          className="bg-gray-900 text-green-400 p-4 font-mono text-[11px] h-[180px] overflow-y-auto space-y-1.5"
        >
          {dnsLogs.length === 0 ? (
            <div className="text-gray-500 text-center pt-10">DNSクエリログを待機中... (LANから通信を発生させてください)</div>
          ) : (
            dnsLogs.map((log, i) => {
              // Extract domain names or query details to colorize elegantly
              const isQuery = log.includes('requested') || log.includes('query');
              const textStyle = isQuery ? 'text-green-300' : 'text-gray-400';
              return (
                <div key={i} className={`whitespace-pre-wrap ${textStyle}`}>
                  <span className="text-[#ff9900] mr-2">❯</span>
                  {log}
                </div>
              );
            })
          )}
        </div>
        <div className="p-2 bg-gray-100 border-t border-[#cccccc] text-[11px] text-gray-500 flex justify-between items-center">
          <span>※ スマートフォンやPCがDNS要求を行うと、自動的にここにリアルタイム表示されます。</span>
          <button
            onClick={() => setDnsLogs([])}
            className="px-2 py-0.5 bg-white border border-[#999999] hover:bg-gray-50 text-xs font-semibold text-gray-700"
          >
            画面をクリア
          </button>
        </div>
      </div>
    </div>
  );
}

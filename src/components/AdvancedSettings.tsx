import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function AdvancedSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Custom Firewall Filter Rule State
  const [ruleName, setRuleName] = useState('');
  const [direction, setDirection] = useState<'FORWARD' | 'INPUT'>('FORWARD');
  const [protocol, setProtocol] = useState<'tcp' | 'udp' | 'icmp' | 'all'>('tcp');
  const [srcIp, setSrcIp] = useState('');
  const [dstPort, setDstPort] = useState('');
  const [ruleAction, setRuleAction] = useState<'DROP' | 'REJECT' | 'ACCEPT'>('DROP');

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

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    const res = await fetch('/api/config/firewall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strict_ip_binding: Boolean(config.strict_ip_binding),
        adblock_enabled: Boolean(config.adblock_enabled),
        dos_protection: config.dos_protection !== false,
        block_wan_ping: Boolean(config.block_wan_ping),
        tcp_bbr_enabled: config.tcp_bbr_enabled !== false
      })
    });
    if (res.ok) {
      notify('カーネル防御・TCP BBR・DNS広告ブロック・ステルス設定を即時適用しました。');
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/config/firewall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_rule',
        rule: {
          name: ruleName || 'Filter Rule',
          direction,
          protocol,
          src_ip: srcIp,
          dst_port: dstPort,
          action: ruleAction
        }
      })
    });
    if (res.ok) {
      setRuleName('');
      setSrcIp('');
      setDstPort('');
      fetchConfig();
      notify('カスタムパケットフィルタルールを iptables に追加しました。');
    }
  };

  const handleDelRule = async (id: string) => {
    const res = await fetch('/api/config/firewall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'del_rule',
        rule: { id }
      })
    });
    if (res.ok) {
      fetchConfig();
      notify('パケットフィルタルールを削除しました。');
    }
  };

  const handleSaveSyslog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/config/syslog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syslog_server: config.syslog_server, syslog_port: config.syslog_port })
    });
    notify('Syslogリモート転送設定を適用しました。');
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      {statusMsg && (
        <div className="bg-[#ecfdf5] border border-[#10b981] text-[#065f46] px-4 py-2 mb-4 text-xs font-bold">
          {statusMsg}
        </div>
      )}

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        カーネルセキュリティ・高速化・DNSフィルタ設定
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <form onSubmit={handleSaveSecurity}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[32%] text-left p-2 font-normal">SYN Flood / DoS攻撃防御 (SYN Cookies)</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.dos_protection !== false}
                      onChange={e => setConfig({ ...config, dos_protection: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (<code className="font-mono text-xs">tcp_syncookies=1, rp_filter=1</code> によりIPスプーフィング・DoS攻撃を遮断)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[32%] text-left p-2 font-normal">WAN側 ステルスモード (Ping応答遮断)</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config.block_wan_ping)}
                      onChange={e => setConfig({ ...config, block_wan_ping: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (外部WAN側からの ICMP Echo Request に対して応答しない)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[32%] text-left p-2 font-normal">Google TCP BBR 輻輳制御アルゴリズム</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.tcp_bbr_enabled !== false}
                      onChange={e => setConfig({ ...config, tcp_bbr_enabled: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (<code className="font-mono text-xs">net.ipv4.tcp_congestion_control=bbr</code> で無線・高遅延回線のスループットを最大化)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[32%] text-left p-2 font-normal">DNS Sinkhole 広告・トラッカーブロック</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config.adblock_enabled)}
                      onChange={e => setConfig({ ...config, adblock_enabled: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (主要広告配信・トラッキングドメインを dnsmasq レベルで <code className="font-mono text-xs">0.0.0.0</code> へ遮断)
                  </label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[32%] text-left p-2 font-normal">厳格なMAC/IPバインディング検証</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config.strict_ip_binding)}
                      onChange={e => setConfig({ ...config, strict_ip_binding: e.target.checked })}
                      className="mr-2"
                    />
                    有効にする (ARPスプーフィングおよび未登録IPからの不正パケット通過を防止)
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] cursor-pointer">
            セキュリティ・カーネル設定を適用
          </button>
        </form>
      </div>

      {/* Custom Packet Filter Table */}
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        パケットフィルタ設定 (iptables カスタムACLルール)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-3 text-xs text-[#555]">
          特定の送信元IPや宛先ポート（例: 25番SMTPスパム防止、445番SMB遮断、特定IPのアクセス制限）に対するパケットフィルタを定義します。
        </p>
        <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4 text-center">
          <thead className="bg-[#eef3f6]">
            <tr>
              <th className="border border-[#cccccc] p-2 font-normal">ルール名</th>
              <th className="border border-[#cccccc] p-2 font-normal">チェイン</th>
              <th className="border border-[#cccccc] p-2 font-normal">プロトコル</th>
              <th className="border border-[#cccccc] p-2 font-normal">送信元IP (空欄=ANY)</th>
              <th className="border border-[#cccccc] p-2 font-normal">宛先ポート</th>
              <th className="border border-[#cccccc] p-2 font-normal">アクション</th>
              <th className="border border-[#cccccc] p-2 font-normal w-20">削除</th>
            </tr>
          </thead>
          <tbody>
            {(config.firewall_rules || []).map(r => (
              <tr key={r.id}>
                <td className="border border-[#cccccc] p-2 font-bold">{r.name}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{r.direction}</td>
                <td className="border border-[#cccccc] p-2 font-mono uppercase">{r.protocol}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{r.src_ip || 'ANY (0.0.0.0/0)'}</td>
                <td className="border border-[#cccccc] p-2 font-mono">{r.dst_port || 'ALL'}</td>
                <td className="border border-[#cccccc] p-2">
                  <span className={`px-2 py-0.5 text-xs font-bold font-mono ${r.action === 'ACCEPT' ? 'text-[#166534] bg-[#dcfce7]' : 'text-[#991b1b] bg-[#fee2e2]'}`}>
                    {r.action}
                  </span>
                </td>
                <td className="border border-[#cccccc] p-2">
                  <button
                    type="button"
                    onClick={() => handleDelRule(r.id)}
                    className="bg-[#cc0000] border border-[#990000] text-white px-2 py-0.5 text-xs hover:bg-[#aa0000] cursor-pointer"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {(config.firewall_rules || []).length === 0 && (
              <tr>
                <td colSpan={7} className="border border-[#cccccc] p-4 text-[#666]">
                  カスタムパケットフィルタルールは登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={handleAddRule} className="bg-[#eef3f6] p-3 border border-[#cccccc] grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
          <input
            type="text"
            placeholder="ルール名 (例: SMB遮断)"
            value={ruleName}
            onChange={e => setRuleName(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs bg-white"
            required
          />
          <select value={direction} onChange={e => setDirection(e.target.value as any)} className="border border-[#aaa] p-1.5 text-xs font-mono bg-white">
            <option value="FORWARD">FORWARD (通過)</option>
            <option value="INPUT">INPUT (本機宛)</option>
          </select>
          <select value={protocol} onChange={e => setProtocol(e.target.value as any)} className="border border-[#aaa] p-1.5 text-xs font-mono bg-white">
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
            <option value="all">ALL</option>
          </select>
          <input
            type="text"
            placeholder="送信元IP (任意)"
            value={srcIp}
            onChange={e => setSrcIp(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs font-mono bg-white"
          />
          <input
            type="text"
            placeholder="宛先ポート (例: 445)"
            value={dstPort}
            onChange={e => setDstPort(e.target.value)}
            className="border border-[#aaa] p-1.5 text-xs font-mono bg-white"
          />
          <select value={ruleAction} onChange={e => setRuleAction(e.target.value as any)} className="border border-[#aaa] p-1.5 text-xs font-mono bg-white font-bold">
            <option value="DROP">DROP (破棄)</option>
            <option value="REJECT">REJECT (拒否応答)</option>
            <option value="ACCEPT">ACCEPT (許可)</option>
          </select>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-3 py-1.5 font-bold text-xs hover:bg-[#0044cc] cursor-pointer">
            フィルタ追加
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        リモートログ転送 (Syslog)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <p className="mb-3 text-xs text-[#555]">ルーターのシステムログを外部のSyslogサーバー（NAS、Splunk、Datadog等）へUDPリアルタイム転送します。</p>
        <form onSubmit={handleSaveSyslog}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Syslogサーバー IP/ホスト名</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="text" value={config.syslog_server || ''} onChange={e => setConfig({ ...config, syslog_server: e.target.value })} placeholder="空欄で無効化" className="border border-[#aaa] p-1 w-[60%] font-mono" />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">ポート番号 (UDP)</th>
                <td className="border border-[#cccccc] p-2">
                  <input type="number" value={config.syslog_port || '514'} onChange={e => setConfig({ ...config, syslog_port: e.target.value })} className="border border-[#aaa] p-1 w-[120px] font-mono" />
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] cursor-pointer">
            Syslog設定適用
          </button>
        </form>
      </div>
    </div>
  );
}

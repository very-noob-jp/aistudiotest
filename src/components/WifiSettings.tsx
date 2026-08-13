import React, { useEffect, useState } from 'react';
import type { RouterConfig } from '../types';

export default function WifiSettings() {
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [savingApSec, setSavingApSec] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [switchingMode, setSwitchingMode] = useState(false);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleModeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (config.wifi_mode === 'STA' && !config.sta_ssid?.trim()) {
      alert('接続先 Wi-Fi (SSID) を指定してください。');
      return;
    }

    setSwitchingMode(true);
    try {
      const res = await fetch('/api/wifi/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: config.wifi_mode,
          wifi_mode: config.wifi_mode,
          sta_ssid: config.sta_ssid || '',
          sta_pwd: config.sta_pwd || ''
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Wi-Fi 動作モードを適用しました。');
      } else {
        alert('エラー: ' + (data.error || '動作モード設定の適用に失敗しました。'));
      }
    } catch (e) {
      alert('Wi-Fi 動作モード設定中に通信エラーが発生しました。');
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleApSecuritySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (config.ap_security !== 'open') {
      const pwd = config.ap_password || '';
      if (pwd.length < 8) {
        alert('WPA2/WPA3 暗号化キーは 8 文字以上で入力してください。');
        return;
      }
    }

    setSavingApSec(true);
    try {
      const res = await fetch('/api/wifi/ap-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ap_ssid: config.ap_ssid || 'Free_WiFi_Pi',
          ap_security: config.ap_security || 'wpa2_psk',
          ap_password: config.ap_password || ''
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Wi-Fi AP セキュリティ設定を更新・適用しました。');
      } else {
        alert('エラー: ' + (data.error || '適用失敗'));
      }
    } catch (e) {
      alert('APセキュリティ設定適用エラーが発生しました。');
    } finally {
      setSavingApSec(false);
    }
  };

  const handleAdvSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await fetch('/api/wifi/advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ band: config.wifi_band, isolation: config.ap_isolation })
    });
    alert('詳細設定を適用しました。');
  };

  const handleInitAp = async () => {
    if (!confirm('wlan0 のアクセスポイント(AP)構成を初期化して、起動処理を実行しますか？')) return;
    setInitializing(true);
    try {
      const res = await fetch('/api/wifi/init-ap', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'wlan0 APの構築と起動処理が完了しました。');
      } else {
        alert('エラー: ' + (data.error || '起動に失敗しました'));
      }
    } catch (e) {
      alert('AP初期化リクエスト送信エラーが発生しました。');
    } finally {
      setInitializing(false);
    }
  };

  if (!config) return <div className="text-[#666]">読み込み中...</div>;

  return (
    <div>
      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        無線LAN (wlan0) AP構築・ワンクリック修復
      </h2>
      <div className="border border-[#003399] bg-[#eef3f6] p-4 mb-6 text-xs text-[#333333]">
        <p className="font-bold text-[#003399] text-sm mb-1">【wlan0 ネットワーク設計要件】</p>
        <ul className="list-disc pl-5 space-y-1 mb-3 text-[#222]">
          <li><strong>wlan0 はクライアント接続専用のAP（アクセスポイント）</strong>として動作します。</li>
          <li><strong>サービス提供時、wlan0 自身は外部ネットワーク（DHCP等）からインターネットを取得しません。</strong></li>
          <li>インターネット接続（WAN）は有線LAN (eth0) や USBテザリングから取得され、wlan0 接続機器へNATルーティングされます。</li>
          <li>Raspberry Pi 特有の RF-kill 解除、NetworkManager除外設定、hostapd &amp; dnsmasq 設定を自動実施します。</li>
        </ul>
        <button 
          onClick={handleInitAp} 
          disabled={initializing}
          className="bg-[#003399] border border-[#002266] text-white px-5 py-2 font-bold hover:bg-[#0044cc] disabled:opacity-50 text-xs flex items-center gap-2"
        >
          {initializing ? 'wlan0 AP構築中...' : '⚡ wlan0 アクセスポイント(AP) 完全構築 & 起動'}
        </button>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        Wi-Fi アクセスポイント (AP) セキュリティ設定
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-3 text-xs text-[#555]">
          配信する Wi-Fi (SSID) の名前、暗号化セキュリティ（パスワードあり / なし / オープン）を設定します。
        </p>
        <form onSubmit={handleApSecuritySave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">SSID (Wi-Fi名)</th>
                <td className="border border-[#cccccc] p-2">
                  <input 
                    type="text" 
                    value={config.ap_ssid || 'Free_WiFi_Pi'} 
                    onChange={e => setConfig({...config, ap_ssid: e.target.value})} 
                    className="border border-[#aaa] p-1.5 w-[80%] text-xs font-mono" 
                    placeholder="例: Free_WiFi_Pi"
                    required 
                  />
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">セキュリティ方式</th>
                <td className="border border-[#cccccc] p-2 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="ap_security" 
                      value="open" 
                      checked={(config.ap_security || 'wpa2_psk') === 'open'} 
                      onChange={() => setConfig({...config, ap_security: 'open'})} 
                    />
                    <span className="font-bold text-[#cc0000]">パスワードなし (オープン / キャプティブポータル・ゲストWi-Fi用)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="ap_security" 
                      value="wpa2_psk" 
                      checked={(config.ap_security || 'wpa2_psk') === 'wpa2_psk'} 
                      onChange={() => setConfig({...config, ap_security: 'wpa2_psk'})} 
                    />
                    <span>WPA2-PSK (標準 暗号化キーあり)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="ap_security" 
                      value="wpa3_sae" 
                      checked={(config.ap_security || 'wpa2_psk') === 'wpa3_sae'} 
                      onChange={() => setConfig({...config, ap_security: 'wpa3_sae'})} 
                    />
                    <span>WPA3-SAE / WPA2-PSK (最新 Personal セキュリティ)</span>
                  </label>
                </td>
              </tr>
              {config.ap_security !== 'open' && (
                <tr>
                  <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">Wi-Fi パスワード</th>
                  <td className="border border-[#cccccc] p-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        value={config.ap_password || ''} 
                        onChange={e => setConfig({...config, ap_password: e.target.value})} 
                        className="border border-[#aaa] p-1.5 w-[60%] text-xs font-mono" 
                        placeholder="8文字以上の暗号化キー"
                        required={config.ap_security !== 'open'}
                        minLength={8}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="border border-[#aaa] bg-[#eee] px-2 py-1 text-xs hover:bg-[#ddd]"
                      >
                        {showPassword ? '非表示' : '表示'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#666] mt-1">※半角英数字8文字以上を指定してください。</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <button 
            type="submit" 
            disabled={savingApSec}
            className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] disabled:opacity-50 text-xs"
          >
            {savingApSec ? 'APセキュリティ設定適用中...' : 'APセキュリティ設定を保存・再起動'}
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        無線LAN 動作モード設定
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa] mb-6">
        <p className="mb-4">本機の無線LANの動作モードを切り替えます。</p>
        <form onSubmit={handleModeSave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">モード切替</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="block mb-2">
                    <input type="radio" name="mode" value="AP" checked={config.wifi_mode === 'AP'} onChange={() => setConfig({...config, wifi_mode: 'AP'})} className="mr-2" />
                    アクセスポイント (Free Wi-Fi提供用)
                  </label>
                  <label className="block">
                    <input type="radio" name="mode" value="STA" checked={config.wifi_mode === 'STA'} onChange={() => setConfig({...config, wifi_mode: 'STA'})} className="mr-2" />
                    クライアント (普段使い・既存Wi-Fiへ接続)
                  </label>
                </td>
              </tr>
              {config.wifi_mode === 'STA' && (
                <>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">接続先 SSID</th>
                    <td className="border border-[#cccccc] p-2">
                      <input type="text" value={config.sta_ssid || ''} onChange={e => setConfig({...config, sta_ssid: e.target.value})} className="border border-[#aaa] p-1 w-[80%]" required />
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">パスワード</th>
                    <td className="border border-[#cccccc] p-2">
                      <input type="password" value={config.sta_pwd || ''} onChange={e => setConfig({...config, sta_pwd: e.target.value})} className="border border-[#aaa] p-1 w-[80%]" />
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <button 
            type="submit" 
            disabled={switchingMode}
            className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc] disabled:opacity-50"
          >
            {switchingMode ? 'モード切り替え中...' : '設定適用'}
          </button>
        </form>
      </div>

      <h2 className="text-[16px] text-[#003399] border-l-[5px] border-l-[#003399] pl-2.5 border-b border-[#cccccc] pb-1 mt-0 mb-4 font-bold">
        詳細設定 (APモード用)
      </h2>
      <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
        <form onSubmit={handleAdvSave}>
          <table className="w-full border-collapse border border-[#cccccc] bg-white text-[13px] mb-4">
            <tbody>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">周波数帯域</th>
                <td className="border border-[#cccccc] p-2">
                  <label className="mr-4"><input type="radio" name="band" value="2g" checked={config.wifi_band === '2g'} onChange={() => setConfig({...config, wifi_band: '2g'})} className="mr-1" /> 2.4 GHz</label>
                  <label><input type="radio" name="band" value="5g" checked={config.wifi_band === '5g'} onChange={() => setConfig({...config, wifi_band: '5g'})} className="mr-1" /> 5.0 GHz</label>
                </td>
              </tr>
              <tr>
                <th className="border border-[#cccccc] bg-[#eef3f6] w-[30%] text-left p-2 font-normal">APアイソレーション</th>
                <td className="border border-[#cccccc] p-2">
                   <label className="mr-4"><input type="radio" name="iso" checked={config.ap_isolation === true} onChange={() => setConfig({...config, ap_isolation: true})} className="mr-1" /> 遮断ON</label>
                   <label><input type="radio" name="iso" checked={config.ap_isolation === false} onChange={() => setConfig({...config, ap_isolation: false})} className="mr-1" /> 通信許可</label>
                </td>
              </tr>
            </tbody>
          </table>
          <button type="submit" className="bg-[#003399] border border-[#002266] text-white px-4 py-1.5 font-bold hover:bg-[#0044cc]">
            詳細設定適用
          </button>
        </form>
      </div>
    </div>
  );
}

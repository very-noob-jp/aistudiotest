import React, { useState, useEffect } from 'react';

interface AuthStatus {
  authenticated: boolean;
  client_ip: string;
  client_mac: string | null;
  portal_authed: boolean;
  portal_enabled: boolean;
  captcha_provider: string;
  ssid: string;
  local_dns_name: string;
  lan_ip: string;
}

export default function Login({
  onLogin,
  isAlreadyAdmin = false
}: {
  onLogin: () => void;
  isAlreadyAdmin?: boolean;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [connectingNet, setConnectingNet] = useState(false);
  const [netMsg, setNetMsg] = useState('');

  const fetchStatus = () => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      onLogin();
    } else {
      setError('管理者パスワードが正しくありません。');
    }
  };

  const handleQuickNetAuth = async () => {
    setConnectingNet(true);
    setNetMsg('');
    try {
      const res = await fetch('/api/portal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ json: true })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNetMsg('この端末のインターネット接続を許可しました。');
        fetchStatus();
      } else {
        setNetMsg(data.message || 'ポータル画面から認証を行ってください。');
      }
    } catch {
      setNetMsg('通信エラーが発生しました。');
    } finally {
      setConnectingNet(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8edf2] flex flex-col items-center justify-center p-4 font-sans text-[#222222]">
      <div className="w-full max-w-[460px] bg-white border border-[#8899aa] shadow-sm">
        {/* Top Enterprise Router Header */}
        <div className="bg-[#003399] text-white px-5 py-3.5 border-b-4 border-[#ff9900] flex justify-between items-center">
          <div>
            <div className="text-[16px] font-bold tracking-tight">PiFi Enterprise Router Web設定</div>
            <div className="text-[11px] text-[#ccd9ff] font-mono">
              http://{status?.local_dns_name || 'pifi.me'}/login ({status?.lan_ip || '192.168.4.1'})
            </div>
          </div>
          <span className="text-[11px] font-mono bg-[#002266] px-2.5 py-1 border border-[#3355aa]">
            GATEWAY OS
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Device & Gateway Info Bar */}
          <div className="bg-[#f4f7fa] border border-[#ccd6e0] p-3 text-[12px] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#556677]">接続先 SSID:</span>
              <span className="font-mono font-bold text-[#003399]">{status?.ssid || 'Free_WiFi_Pi'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#556677]">端末 IP / MAC:</span>
              <span className="font-mono text-[#333333]">
                {status?.client_ip || '192.168.4.x'} {status?.client_mac ? `(${status.client_mac.toUpperCase()})` : ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#556677]">インターネット認証状態:</span>
              <span className={`font-bold ${status?.portal_authed ? 'text-[#15803d]' : 'text-[#b45309]'}`}>
                {status?.portal_authed ? '● 認証済み (通信可能)' : '○ 未認証 (ポータル承認待ち)'}
              </span>
            </div>
          </div>

          {/* Admin Login Form */}
          <div className="border border-[#cccccc] p-4 bg-[#fafafa]">
            <div className="text-[13px] font-bold text-[#003399] border-b border-[#cccccc] pb-1.5 mb-3">
              ルーター管理者ログイン (Admin Console)
            </div>

            {isAlreadyAdmin ? (
              <div className="text-center py-2 space-y-3">
                <p className="text-xs text-[#15803d] font-bold">現在、管理者としてログイン済みです。</p>
                <button
                  type="button"
                  onClick={onLogin}
                  className="w-full bg-[#003399] border border-[#002266] hover:bg-[#0044cc] text-white font-bold text-sm py-2 px-4 cursor-pointer"
                >
                  ルーター管理画面を開く
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-[#555555] mb-3">
                  ルーター設定を変更するには管理者パスワードを入力してください。（初期値: <code className="font-mono bg-[#eaeaea] px-1">admin</code>）
                </p>
                {error && (
                  <div className="bg-[#fef2f2] border border-[#f87171] text-[#b91c1c] text-xs font-bold p-2 mb-3 text-center">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#333333] mb-1">管理者パスワード</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="パスワードを入力"
                      className="border border-[#7f9db9] px-3 py-1.5 w-full text-sm focus:outline-none focus:border-[#003399] bg-white font-mono"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#003399] border border-[#002266] hover:bg-[#0044cc] text-white font-bold text-sm py-2 px-4 cursor-pointer"
                  >
                    管理画面へログイン
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Client Internet Access Section (No reCAPTCHA) */}
          <div className="border border-[#cccccc] p-4 bg-[#f9fbfd]">
            <div className="text-[13px] font-bold text-[#0f5132] border-b border-[#cccccc] pb-1.5 mb-2.5">
              ゲストWi-Fi / インターネット接続認証 (CAPTCHAなし)
            </div>
            <p className="text-xs text-[#555555] mb-3">
              現在お使いの端末をインターネットへ接続させる場合は、下のボタンからワンタップで接続承認できます。
            </p>
            {netMsg && (
              <div className="bg-[#ecfdf5] border border-[#6ee7b7] text-[#065f46] text-xs font-bold p-2 mb-3 text-center">
                {netMsg}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleQuickNetAuth}
                disabled={connectingNet}
                className="flex-1 bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs py-2 px-3 cursor-pointer disabled:opacity-50"
              >
                {connectingNet ? '接続処理中...' : 'この端末を今すぐネット接続許可'}
              </button>
              <a
                href="/portal"
                className="bg-[#eeeeee] border border-[#888888] hover:bg-[#dddddd] text-[#222222] text-xs font-bold py-2 px-3 text-center no-underline"
              >
                ポータル画面を開く
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

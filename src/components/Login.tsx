import React, { useState } from 'react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    
    if (res.ok) {
      onLogin();
    } else {
      setError('パスワードが間違っています。');
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex flex-col items-center pt-20 font-sans">
      <div className="w-[400px] bg-white border border-[#999999] shadow-sm">
        <div className="bg-[#003366] text-white px-4 py-2 font-bold text-sm">
          ルーター Web設定 ログイン
        </div>
        <div className="p-6">
          <p className="text-sm text-[#333333] mb-4 text-center">機器の管理者パスワードを入力してください。</p>
          {error && <div className="text-[#cc0000] text-sm font-bold mb-4 text-center">{error}</div>}
          <form onSubmit={handleSubmit} className="flex flex-col items-center">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-[#7f9db9] px-2 py-1 w-48 mb-4 focus:outline-none focus:border-[#003366]"
              required
            />
            <button
              type="submit"
              className="bg-[#dddddd] border border-[#888888] hover:bg-[#cccccc] text-black text-sm px-6 py-1 cursor-pointer"
            >
              ログイン
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

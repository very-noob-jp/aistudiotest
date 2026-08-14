import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const execAsync = util.promisify(exec);

export const CONFIG_FILE = path.join(process.cwd(), 'router_config.json');
export const PORTAL_FILE = path.join(process.cwd(), 'portal.html');
export const AUTH_FILE = path.join(process.cwd(), 'auth_macs.json');

export interface CmdLog {
  id: string;
  timestamp: string;
  command: string;
  status: 'SUCCESS' | 'SIMULATED' | 'FAILED';
  output: string;
}

const cmdLogs: CmdLog[] = [
  {
    id: 'init-1',
    timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
    command: 'systemctl status hostapd dnsmasq',
    status: 'SUCCESS',
    output: '● hostapd.service - Advanced IEEE 802.11 AP & Authenticator\n   Active: active (running)'
  }
];

export function getCmdLogs() {
  return cmdLogs;
}

export function addCmdLog(log: Omit<CmdLog, 'id' | 'timestamp'>) {
  const newLog: CmdLog = {
    id: Math.random().toString(36).substring(2, 10),
    timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
    ...log
  };
  cmdLogs.unshift(newLog);
  if (cmdLogs.length > 200) cmdLogs.pop();
  return newLog;
}

const serviceStates: Record<string, 'active' | 'inactive'> = {
  hostapd: 'active',
  dnsmasq: 'active',
  'wg-quick@wg0': 'inactive',
  rsyslog: 'inactive',
  smbd: 'inactive',
  strongswan: 'inactive',
  xl2tpd: 'inactive'
};

const isRealHost = fs.existsSync('/run/systemd/system') || fs.existsSync('/sys/class/thermal/thermal_zone0/temp') || fs.existsSync('/etc/rpi-issue');

export async function runSudo(cmd: string): Promise<string> {
  // Update virtual service state if systemctl
  if (cmd.startsWith('systemctl start ')) {
    const svcs = cmd.replace('systemctl start ', '').trim().split(/\s+/);
    svcs.forEach(s => { serviceStates[s] = 'active'; });
  } else if (cmd.startsWith('systemctl stop ')) {
    const svcs = cmd.replace('systemctl stop ', '').trim().split(/\s+/);
    svcs.forEach(s => { serviceStates[s] = 'inactive'; });
  } else if (cmd.startsWith('systemctl restart ')) {
    const svcs = cmd.replace('systemctl restart ', '').trim().split(/\s+/);
    svcs.forEach(s => { serviceStates[s] = 'active'; });
  }

  try {
    const { stdout } = await execAsync(`sudo ${cmd}`);
    const res = (stdout || '').trim();
    addCmdLog({
      command: `sudo ${cmd}`,
      status: 'SUCCESS',
      output: res || '(exit 0)'
    });
    return res;
  } catch (e: any) {
    const stderrStr = e.stderr ? e.stderr.trim() : '';
    const stdoutStr = e.stdout ? e.stdout.trim() : '';

    // Handling systemctl is-active status outputs (active, inactive, failed, etc.)
    if (cmd.includes('systemctl is-active')) {
      const activeState = (stdoutStr || stderrStr).trim();
      if (['active', 'inactive', 'failed', 'activating', 'deactivating'].includes(activeState)) {
        addCmdLog({
          command: `sudo ${cmd}`,
          status: 'SUCCESS',
          output: activeState
        });
        return activeState;
      }
    }

    // Check if sudo failed because password is required
    if (stderrStr.includes('a password is required') || stderrStr.includes('no tty present')) {
      const errMsg = `[FAILED] sudoの実行にパスワードが必要です。「sudo npm start」で起動するか、visudoでNOPASSWDを設定してください。 (${stderrStr})`;
      addCmdLog({
        command: `sudo ${cmd}`,
        status: 'FAILED',
        output: errMsg
      });
      return '';
    }

    // If running on real Raspberry Pi / systemd host:
    if (isRealHost) {
      const errOut = stderrStr || stdoutStr || e.message || 'Exit code ' + (e.code || 1);
      addCmdLog({
        command: `sudo ${cmd}`,
        status: 'FAILED',
        output: errOut
      });
      return stdoutStr;
    }

    // Fallback for Cloud Run / Container Sandbox (SIMULATION)
    let mockOutput = '';
    if (cmd.includes('systemctl is-active')) {
      const parts = cmd.trim().split(/\s+/);
      const svc = parts[parts.length - 1];
      mockOutput = serviceStates[svc] || 'active';
    } else if (cmd.includes('cat /sys/class/thermal/thermal_zone0/temp')) {
      mockOutput = '45000';
    } else if (cmd.includes('free -m')) {
      mockOutput = '              total        used        free      shared  buff/cache   available\nMem:           3927         500        2000          50        1427        3000';
    } else if (cmd.includes('df -h /')) {
      mockOutput = 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        30G   15G   15G  50% /';
    } else if (cmd.includes('uptime -p')) {
      mockOutput = 'up 2 hours, 30 minutes';
    } else if (cmd.includes('ip neigh')) {
      mockOutput = '192.168.4.10 dev wlan0 lladdr 00:11:22:33:44:55 REACHABLE\n192.168.4.11 dev eth0 lladdr aa:bb:cc:dd:ee:ff STALE';
    } else if (cmd.includes('ip route show default')) {
      mockOutput = 'default via 192.168.1.1 dev wlan0 proto dhcp src 192.168.1.10 metric 303';
    } else if (cmd.includes('tail -n')) {
      mockOutput = 'Jan 01 12:00:00 router systemd[1]: Started hostapd Service...\nJan 01 12:00:05 router dnsmasq[123]: read /etc/hosts';
    } else {
      mockOutput = '[SIMULATED OK] Command registered for Linux environment';
    }

    addCmdLog({
      command: `sudo ${cmd}`,
      status: 'SIMULATED',
      output: mockOutput
    });

    return mockOutput;
  }
}

export async function runPing(host: string) {
  try {
    if (!/^[a-zA-Z0-9.-]+$/.test(host)) return "Invalid host format.";
    const { stdout } = await execAsync(`ping -c 4 ${host}`);
    return stdout;
  } catch (e: any) {
    return e.stdout || 'Ping failed or timed out.';
  }
}

export function loadConfig() {
  const default_config = {
    strict_ip_binding: true,
    admin_password: "admin",
    adblock_enabled: false,
    wifi_mode: "AP",
    sta_ssid: "",
    sta_pwd: "",
    wifi_band: "2g",
    ap_isolation: false,
    ap_ssid: "Free_WiFi_Pi",
    ap_security: "wpa2_psk",
    ap_password: "FreeWiFiSecret123",
    lan_ip: "192.168.4.1",
    subnet_mask: "255.255.255.0",
    dhcp_enabled: true,
    dhcp_start: "192.168.4.10",
    dhcp_end: "192.168.4.200",
    lease_time: "24h",
    static_routes: [],
    vpn_enabled: false,
    vpn_type: "l2tp",
    vpn_psk: "secret_psk_key",
    nas_enabled: false,
    nas_share_name: "PiShare",
    nas_workgroup: "WORKGROUP",
    qos_enabled: false,
    qos_download: "100",
    qos_upload: "100",
    gemini_api_key: "",
    captcha_provider: "hcaptcha",
    captcha_site_key: "",
    captcha_secret_key: "",
    captcha_invisible: false,
    local_dns_enabled: false,
    local_dns_name: "pi.router",
    wg_enabled: false,
    wg_port: "51820",
    syslog_server: "",
    syslog_port: "514"
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...default_config, ...data };
    }
  } catch (e) {}
  return default_config;
}

export function saveConfig(cfg: any) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {}
}

export function loadAuthMacs(): Record<string, number> {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      const config = loadConfig();
      // Default session timeout to 15 minutes
      const timeoutMin = typeof config.session_timeout === 'number' ? config.session_timeout : 15;
      const timeoutMs = timeoutMin * 60 * 1000;
      const now = Date.now();
      
      let changed = false;
      const filtered: Record<string, number> = {};
      for (const [mac, timestamp] of Object.entries(data)) {
        if (now - (timestamp as number) < timeoutMs) {
          filtered[mac] = timestamp as number;
        } else {
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(AUTH_FILE, JSON.stringify(filtered, null, 2));
      }
      return filtered;
    }
  } catch (e) {}
  return {};
}

export function saveAuthMacs(data: Record<string, number>) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

export async function getSysInfo() {
  const info: { temp: string; mem: string; disk: string; uptime: string; wifi_active: boolean; wan_if: string; time: string; cpu_freq?: string } = { temp: "--", mem: "0", disk: "0", uptime: "--", wifi_active: false, wan_if: "Unknown", time: new Date().toLocaleString('ja-JP') };
  
  const tempOut = await runSudo("cat /sys/class/thermal/thermal_zone0/temp");
  if (tempOut && !isNaN(Number(tempOut))) info.temp = (Number(tempOut) / 1000).toFixed(1);
  
  const memOut = await runSudo("free -m | awk 'NR==2{printf \"%d\", $3*100/$2 }'");
  if (memOut) info.mem = memOut; 
  if (info.mem.includes('total')) info.mem = "12";
  
  const diskOut = await runSudo("df -h / | awk '$NF==\"/\"{printf \"%s\", $5}'");
  info.disk = diskOut.replace('%', '');
  if (info.disk.includes('Filesystem')) info.disk = "50";

  const uptimeOut = await runSudo("uptime -p");
  info.uptime = uptimeOut.replace('up ', '');
  
  const config = loadConfig();
  if (config.wifi_mode === 'STA') {
    const wlanShow = await runSudo("ip addr show wlan0");
    const nmShow = await runSudo("nmcli device show wlan0");
    info.wifi_active = (wlanShow.includes("inet ") && !wlanShow.includes("192.168.4.1")) || nmShow.includes("connected");
  } else {
    info.wifi_active = (await runSudo("systemctl is-active hostapd")) === "active";
  }
  
  const wanOut = await runSudo("ip route show default");
  const match = wanOut.match(/dev\s+(\S+)/);
  info.wan_if = match ? match[1] : "Unknown";
  if (info.wan_if.startsWith('enx') || info.wan_if.startsWith('usb') || info.wan_if.length > 10) {
    info.wan_if = "usb-tether";
  }

  // Get Raspberry Pi 4B CPU Freq
  const freqStr = await runSudo("cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq");
  if (freqStr) {
    const freqInt = parseInt(freqStr.trim(), 10);
    if (!isNaN(freqInt)) {
      info.cpu_freq = (freqInt / 1000).toFixed(0) + " MHz";
    }
  }

  const vcgencmd = await runSudo("vcgencmd measure_temp");
  if (vcgencmd) {
    info.temp = vcgencmd.replace("temp=", "");
  }
  
  return info;
}

export async function getConnectedDevices() {
  const devices: any[] = [];
  const out = await runSudo("ip neigh");
  const lines = out.split('\n');
  for (const line of lines) {
    if (line.includes('lladdr')) {
      const parts = line.split(' ');
      const ip = parts[0];
      const lladdrIndex = parts.indexOf('lladdr');
      const mac = parts[lladdrIndex + 1]?.toLowerCase();
      const dev = parts[2];
      if (ip && mac && dev && !ip.startsWith('fe80') && ip !== '127.0.0.1') {
        const traffic = parseInt(crypto.createHash('md5').update(mac).digest('hex').substring(0,2), 16) % 100;
        devices.push({ ip, mac, dev, traffic });
      }
    }
  }
  return devices;
}

export async function getMacFromIp(ip: string) {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return null;
  // Clean IPv4-mapped IPv6 address (e.g. ::ffff:192.168.4.10 -> 192.168.4.10)
  const cleanIp = ip.replace(/^.*:/, '');
  const res = await runSudo(`ip neigh show ${cleanIp}`);
  const match = res.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
  return match ? match[0].toLowerCase() : null;
}

export async function setupWifiAP() {
  // Clear persistent authorized MACs so rebuilding/rebooting forces re-authentication!
  saveAuthMacs({});

  const config = loadConfig();
  const ip = config.lan_ip || '192.168.4.1';
  const dhcpStart = config.dhcp_start || '192.168.4.10';
  const dhcpEnd = config.dhcp_end || '192.168.4.200';
  const band = config.wifi_band || '2g';
  const hw_mode = band === '5g' ? 'a' : 'g';
  const channel = band === '5g' ? '36' : '6';

  const ssid = config.ap_ssid || 'Free_WiFi_Pi';
  const security = config.ap_security || 'wpa2_psk';
  const passphrase = config.ap_password || 'FreeWiFiSecret123';
  const apIsolateStr = config.ap_isolation ? 'ap_isolate=1\n' : '';

  let secConf = '';
  if (security === 'open') {
    secConf = '# Open Wi-Fi Network (No password)\n';
  } else if (security === 'wpa3_sae') {
    secConf = `wpa=2
wpa_key_mgmt=WPA-PSK SAE
ieee80211w=1
wpa_pairwise=CCMP
rsn_pairwise=CCMP
wpa_passphrase=${passphrase}
`;
  } else {
    // Default WPA2-PSK
    secConf = `wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
wpa_passphrase=${passphrase}
`;
  }

  // 1. Unblock RF-kill for Wi-Fi on Raspberry Pi
  await runSudo("rfkill unblock wlan || true");
  await runSudo("rfkill unblock wifi || true");

  // 2. Unmask and enable systemd services
  await runSudo("systemctl unmask hostapd || true");
  await runSudo("systemctl enable hostapd || true");
  await runSudo("systemctl enable dnsmasq || true");

  // 3. Prevent NetworkManager / dhcpcd from managing wlan0 as a client in AP mode (Persistent & Runtime)
  await runSudo(`bash -c 'mkdir -p /etc/NetworkManager/conf.d && echo -e "[keyfile]\\nunmanaged-devices=interface-name:wlan0" > /etc/NetworkManager/conf.d/99-unmanaged-devices.conf' || true`);
  await runSudo("systemctl reload NetworkManager || true");
  await runSudo("nmcli device set wlan0 managed no || true");
  await runSudo("pkill -9 wpa_supplicant || true");
  await runSudo("systemctl stop wpa_supplicant || true");

  // 4. Ensure /etc/dhcpcd.conf ignores wlan0 completely (if dhcpcd is present)
  await runSudo("sed -i '/# --- RPI-ROUTER-WLAN0-START ---/,/# --- RPI-ROUTER-WLAN0-END ---/d' /etc/dhcpcd.conf || true");
  await runSudo("sed -i '/interface wlan0/,+4d' /etc/dhcpcd.conf || true");
  await runSudo(`bash -c 'if [ -f /etc/dhcpcd.conf ]; then echo -e "\\n# --- RPI-ROUTER-WLAN0-START ---\\ndenyinterfaces wlan0\\n# --- RPI-ROUTER-WLAN0-END ---" >> /etc/dhcpcd.conf; fi' || true`);
  await runSudo("systemctl reload dhcpcd || true");

  // 5. Ensure /etc/default/hostapd has DAEMON_CONF set
  await runSudo('grep -q "DAEMON_CONF=" /etc/default/hostapd && sed -i "s|^#*DAEMON_CONF=.*|DAEMON_CONF=\\"/etc/hostapd/hostapd.conf\\"|" /etc/default/hostapd || echo \'DAEMON_CONF="/etc/hostapd/hostapd.conf"\' >> /etc/default/hostapd');

  // 6. Ensure /etc/hostapd/hostapd.conf exists with working config
  const hostapdConf = `interface=wlan0
driver=nl80211
ssid=${ssid}
hw_mode=${hw_mode}
channel=${channel}
wmm_enabled=1
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
country_code=JP
${apIsolateStr}${secConf}`;
  await runSudo(`bash -c 'cat << "EOF" > /etc/hostapd/hostapd.conf\n${hostapdConf}EOF' || true`);

  // 7. Ensure /etc/dnsmasq.conf includes /etc/dnsmasq.d directory
  await runSudo('grep -q "conf-dir=/etc/dnsmasq.d" /etc/dnsmasq.conf || echo "conf-dir=/etc/dnsmasq.d,.rpmnew,.rpmsave,.dpkg-dist" >> /etc/dnsmasq.conf');

  // 8. Ensure /etc/dnsmasq.d/wlan0.conf is set for wlan0 DHCP with dhcp-authoritative and isolated interface binding
  const dnsmasqConf = `interface=wlan0
bind-interfaces
listen-address=${ip}
dhcp-range=${dhcpStart},${dhcpEnd},255.255.255.0,${config.lease_time || '24h'}
dhcp-option=option:router,${ip}
dhcp-option=option:dns-server,${ip},8.8.8.8
dhcp-authoritative
domain-needed
bogus-priv
`;
  await runSudo(`bash -c 'cat << "EOF" > /etc/dnsmasq.d/wlan0.conf\n${dnsmasqConf}EOF' || true`);

  // 9. Start hostapd FIRST so interface is put into AP mode
  await runSudo("systemctl restart hostapd || true");

  // Wait for hostapd to fully initialize and reset wlan0 (Critical to prevent race condition where hostapd's interface reset flushes our IP)
  await runSudo("sleep 2 || true");

  // 10. Assign static IP to wlan0 AFTER hostapd has initialized wlan0
  await runSudo("ip link set wlan0 up || true");
  await runSudo("ip addr flush dev wlan0 || true");
  await runSudo(`ip addr add ${ip}/24 dev wlan0 || true`);

  // Double-check and force static IP in case of persistent race conditions
  let ipCheck = await runSudo("ip addr show wlan0");
  if (!ipCheck.includes(ip)) {
    await runSudo("sleep 1 || true");
    await runSudo("ip link set wlan0 up || true");
    await runSudo(`ip addr add ${ip}/24 dev wlan0 || true`);
  }

  // 11-12. Setup Firewall, NAT, and Redirection rules for wlan0
  await applyFirewallRules();

  // 13. Restart dnsmasq AFTER wlan0 static IP is firmly assigned
  await runSudo("systemctl restart dnsmasq || true");

  return { success: true };
}

export async function setWifiMode(mode: 'AP' | 'STA', ssid?: string, pwd?: string) {
  if (mode === 'STA') {
    // 1. Stop hostapd and dnsmasq (AP mode services)
    await runSudo("systemctl stop hostapd dnsmasq || true");

    // 2. Unblock RF-kill for wlan
    await runSudo("rfkill unblock wlan || true");
    await runSudo("rfkill unblock wifi || true");

    // 3. Remove static IP overrides from dhcpcd.conf / NetworkManager if any
    await runSudo("sed -i '/# --- RPI-ROUTER-WLAN0-START ---/,/# --- RPI-ROUTER-WLAN0-END ---/d' /etc/dhcpcd.conf || true");
    await runSudo("sed -i '/interface wlan0/,+4d' /etc/dhcpcd.conf || true");
    await runSudo("rm -f /etc/NetworkManager/conf.d/99-unmanaged-devices.conf || true");
    await runSudo("systemctl reload NetworkManager || true");
    await runSudo("systemctl reload dhcpcd || true");

    // 4. Enable NetworkManager management for wlan0
    await runSudo("nmcli device set wlan0 managed yes || true");

    // 5. Reset wlan0 interface link and flush static AP IP
    await runSudo("ip addr flush dev wlan0 || true");
    await runSudo("ip link set wlan0 up || true");

    let connOutput = "";
    if (ssid) {
      await runSudo("nmcli device wifi rescan || true");
      if (pwd) {
        connOutput = await runSudo(`nmcli device wifi connect "${ssid}" password "${pwd}" || true`);
      } else {
        connOutput = await runSudo(`nmcli device wifi connect "${ssid}" || true`);
      }

      // Fallback: If nmcli fails or wpa_supplicant is needed on Debian/RPi OS
      if (connOutput.includes("Error") || connOutput.includes("failed") || connOutput.includes("No network")) {
        const wpaConf = pwd 
          ? await runSudo(`wpa_passphrase "${ssid}" "${pwd}"`) 
          : `network={\n  ssid="${ssid}"\n  key_mgmt=NONE\n}`;
        await runSudo(`bash -c 'cat << "EOF" > /etc/wpa_supplicant/wpa_supplicant.conf\nctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\nupdate_config=1\n${wpaConf}\nEOF' || true`);
        await runSudo("systemctl restart wpa_supplicant || true");
        await runSudo("dhclient wlan0 || dhcpcd -n wlan0 || true");
      }
    }

    const ipShow = await runSudo("ip addr show wlan0");
    return { success: true, ipShow, connOutput };
  } else {
    return await setupWifiAP();
  }
}

export async function blockMac(mac: string) {
  await runSudo(`iptables -I INPUT -m mac --mac-source ${mac} -j DROP`);
  await runSudo(`iptables -I FORWARD -m mac --mac-source ${mac} -j DROP`);
}

export async function applyFirewallRules() {
  // Allow DHCP (UDP 67/68) and DNS (UDP/TCP 53) in iptables for wlan0
  await runSudo("iptables -D INPUT -i wlan0 -p udp --dport 67:68 -j ACCEPT || true");
  await runSudo("iptables -D INPUT -i wlan0 -p udp --dport 53 -j ACCEPT || true");
  await runSudo("iptables -D INPUT -i wlan0 -p tcp --dport 53 -j ACCEPT || true");

  await runSudo("iptables -I INPUT -i wlan0 -p udp --dport 67:68 -j ACCEPT || true");
  await runSudo("iptables -I INPUT -i wlan0 -p udp --dport 53 -j ACCEPT || true");
  await runSudo("iptables -I INPUT -i wlan0 -p tcp --dport 53 -j ACCEPT || true");

  // Enable IP forwarding
  await runSudo("sysctl -w net.ipv4.ip_forward=1 || true");
  
  // Flush previous rules to prevent redundant chains or duplicate rules
  await runSudo("iptables -F FORWARD || true");
  await runSudo("iptables -t nat -F PREROUTING || true");
  await runSudo("iptables -t nat -F POSTROUTING || true");

  // Masquerade all outbound WAN traffic not destined back to the local AP network (any interface other than wlan0)
  await runSudo("iptables -t nat -A POSTROUTING ! -o wlan0 -j MASQUERADE || true");
  
  // Accept established WAN back to LAN
  await runSudo("iptables -A FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT || true");

  // Dynamic bypass rules: Accept traffic for authenticated clients (skip captive portal redirect)
  const authData = loadAuthMacs();
  for (const mac of Object.keys(authData)) {
    await runSudo(`iptables -t nat -A PREROUTING -m mac --mac-source ${mac} -j RETURN || true`);
    await runSudo(`iptables -A FORWARD -i wlan0 ! -o wlan0 -m mac --mac-source ${mac} -j ACCEPT || true`);
  }

  // Redirection rule: Redirect unauthenticated HTTP (TCP 80) traffic to local router port 3000 (Captive Portal)
  await runSudo("iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 80 -j REDIRECT --to-ports 3000 || true");

  // Drop all other forward traffic for unauthenticated clients on wlan0 heading to WAN (anything not wlan0)
  await runSudo("iptables -A FORWARD -i wlan0 ! -o wlan0 -j DROP || true");
}

export async function reloadRouting() {
  await applyFirewallRules();
}

export async function addPortForward(src_port: string, dest_ip: string, dest_port: string) {
  const wanOut = await runSudo("ip route show default");
  const match = wanOut.match(/dev\s+(\S+)/);
  const wan_if = match ? match[1] : "Unknown";
  if (wan_if !== "Unknown") {
    await runSudo(`iptables -t nat -A PREROUTING -i ${wan_if} -p tcp --dport ${src_port} -j DNAT --to-destination ${dest_ip}:${dest_port}`);
    return true;
  }
  return false;
}

export async function manageStaticRoute(action: 'add' | 'del', dest: string, gw: string, metric: string) {
  await runSudo(`ip route ${action} ${dest} via ${gw} metric ${metric}`);
  return true;
}

export async function applyLanConfig(ip: string, start: string, end: string, lease: string) {
  // Mocking dnsmasq and interface reconfiguration
  await runSudo(`ip addr add ${ip}/24 dev wlan0`);
  await runSudo(`sed -i "s/^dhcp-range=.*/dhcp-range=${start},${end},255.255.255.0,${lease}/" /etc/dnsmasq.conf`);
  await runSudo("systemctl restart dnsmasq");
  return true;
}

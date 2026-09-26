export interface SysInfo {
  temp: string;
  mem: string;
  disk: string;
  uptime: string;
  wifi_active: boolean;
  wan_if: string;
  config_mode: string;
  time: string;
  cpu_freq?: string;
}

export interface ConnectedDevice {
  ip: string;
  mac: string;
  dev: string;
  traffic: number;
  hostname?: string;
  authenticated?: boolean;
  blocked?: boolean;
  alias?: string;
}

export interface StaticRoute {
  id: string;
  dest: string;
  gateway: string;
  metric: string;
}

export interface PortForwardRule {
  id: string;
  name: string;
  protocol: 'tcp' | 'udp' | 'both';
  src_port: string;
  dest_ip: string;
  dest_port: string;
  enabled: boolean;
}

export interface DhcpStaticLease {
  id: string;
  mac: string;
  ip: string;
  hostname: string;
}

export interface CustomDnsRecord {
  id: string;
  domain: string;
  ip: string;
}

export interface FirewallFilterRule {
  id: string;
  name: string;
  direction: 'INPUT' | 'FORWARD';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  src_ip?: string;
  dst_port?: string;
  action: 'ACCEPT' | 'DROP' | 'REJECT';
}

export interface RouterConfig {
  strict_ip_binding: boolean;
  adblock_enabled: boolean;
  admin_password?: string;
  wifi_mode: 'AP' | 'STA';
  sta_ssid?: string;
  sta_pwd?: string;
  wifi_band?: '2g' | '5g';
  wifi_channel?: string;
  ap_isolation?: boolean;
  ap_ssid?: string;
  ap_security?: 'open' | 'wpa2_psk' | 'wpa3_sae';
  ap_password?: string;
  
  // Enterprise Network Settings
  lan_ip?: string;
  subnet_mask?: string;
  dhcp_enabled?: boolean;
  dhcp_start?: string;
  dhcp_end?: string;
  lease_time?: string;
  custom_dns1?: string;
  custom_dns2?: string;
  dhcp_static_leases?: DhcpStaticLease[];
  custom_dns_records?: CustomDnsRecord[];
  
  // Routing & NAT
  static_routes?: StaticRoute[];
  port_forwards?: PortForwardRule[];
  dmz_enabled?: boolean;
  dmz_ip?: string;
  upnp_enabled?: boolean;
  mss_clamping?: boolean;
  
  // VPN Settings
  vpn_enabled?: boolean;
  vpn_type?: 'ipsec' | 'l2tp' | 'openvpn';
  vpn_psk?: string;
  
  // Pi 4B Specific: QoS
  qos_enabled?: boolean;
  qos_download?: string;
  qos_upload?: string;
  
  // AI Assistant
  gemini_api_key?: string;
  
  // Captcha & Portal
  captcha_provider?: 'none' | 'passcode' | 'hcaptcha' | 'recaptcha';
  portal_passcode?: string;
  captcha_site_key?: string;
  captcha_secret_key?: string;
  captcha_invisible?: boolean;
  portal_enabled?: boolean;
  
  // Local DNS
  local_dns_enabled?: boolean;
  local_dns_name?: string;

  // Captive Portal Lease
  session_timeout?: number;

  // Additional Enterprise & Pro Router Features
  wg_enabled?: boolean;
  wg_port?: string;
  syslog_server?: string;
  syslog_port?: string;
  dos_protection?: boolean;
  block_wan_ping?: boolean;
  tcp_bbr_enabled?: boolean;
  firewall_rules?: FirewallFilterRule[];
  blocked_macs?: string[];
  device_aliases?: Record<string, string>;
}

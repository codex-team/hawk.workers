import { isPrivateIP } from '../src/deliverer';

describe('isPrivateIP', () => {
  describe('should block private/reserved IPv4', () => {
    it.each([
      ['127.0.0.1'],
      ['127.255.255.255'],
      ['10.0.0.1'],
      ['10.255.255.255'],
      ['0.0.0.0'],
      ['172.16.0.1'],
      ['172.31.255.255'],
      ['192.168.0.1'],
      ['192.168.255.255'],
      ['169.254.1.1'],
      ['169.254.169.254'],
      ['100.64.0.1'],
      ['100.127.255.255'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should block broadcast and multicast IPv4', () => {
    it.each([
      ['255.255.255.255'],
      ['224.0.0.1'],
      ['239.255.255.255'],
      ['230.1.2.3'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should block documentation and benchmarking IPv4', () => {
    it.each([
      ['192.0.2.1'],
      ['198.51.100.1'],
      ['203.0.113.1'],
      ['198.18.0.1'],
      ['198.19.255.255'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should block private/reserved IPv6', () => {
    it.each([
      ['::1'],
      ['::'],
      ['fe80::1'],
      ['FE80::abc'],
      ['fc00::1'],
      ['fd12:3456::1'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should block IPv6 multicast', () => {
    it.each([
      ['ff02::1'],
      ['ff05::2'],
      ['FF0E::1'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should block IPv6 with zone ID', () => {
    it.each([
      ['fe80::1%lo0'],
      ['fe80::1%eth0'],
      ['::1%lo0'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should block IPv4-mapped IPv6', () => {
    it.each([
      ['::ffff:127.0.0.1'],
      ['::ffff:10.0.0.1'],
      ['::ffff:192.168.1.1'],
      ['::ffff:172.16.0.1'],
      ['::ffff:169.254.169.254'],
      ['::ffff:100.64.0.1'],
      ['::ffff:0.0.0.0'],
      ['::FFFF:127.0.0.1'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(true);
    });
  });

  describe('should allow public IPv4', () => {
    it.each([
      ['8.8.8.8'],
      ['1.1.1.1'],
      ['93.184.216.34'],
      ['172.32.0.1'],
      ['172.15.255.255'],
      ['192.169.0.1'],
      ['100.128.0.1'],
      ['100.63.255.255'],
      ['169.255.0.1'],
      ['223.255.255.255'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(false);
    });
  });

  describe('should allow public IPv6', () => {
    it.each([
      ['2001:db8::1'],
      ['2606:4700::1'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(false);
    });
  });

  describe('should allow public IPv4-mapped IPv6', () => {
    it.each([
      ['::ffff:8.8.8.8'],
      ['::ffff:93.184.216.34'],
    ])('%s', (ip) => {
      expect(isPrivateIP(ip)).toBe(false);
    });
  });
});

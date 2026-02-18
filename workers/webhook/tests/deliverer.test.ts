import { isPrivateIP } from '../src/deliverer';

describe('isPrivateIP', () => {
  it.each([
    ['127.0.0.1', true],
    ['127.255.255.255', true],
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['0.0.0.0', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.0.1', true],
    ['192.168.255.255', true],
    ['169.254.1.1', true],
    ['169.254.169.254', true],
    ['100.64.0.1', true],
    ['100.127.255.255', true],
    ['::1', true],
    ['::', true],
    ['fe80::1', true],
    ['fc00::1', true],
    ['fd12:3456::1', true],
  ])('should block private/reserved IP %s', (ip: string, expected: boolean) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  it.each([
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['93.184.216.34', false],
    ['172.32.0.1', false],
    ['172.15.255.255', false],
    ['192.169.0.1', false],
    ['100.128.0.1', false],
    ['100.63.255.255', false],
    ['169.255.0.1', false],
    ['2001:db8::1', false],
  ])('should allow public IP %s', (ip: string, expected: boolean) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });
});

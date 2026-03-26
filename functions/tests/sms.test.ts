import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { prependCountryCode } from '../src/services/sms';

describe('SMS Service', () => {
  describe('prependCountryCode', () => {
    it('prepends default country code to short number', () => {
      const result = prependCountryCode('98765432', '965', []);
      assert.strictEqual(result, '96598765432');
    });

    it('does not prepend if number already has a known prefix', () => {
      const coverage = [{ prefix: '965' }, { prefix: '966' }];
      const result = prependCountryCode('96598765432', '965', coverage);
      assert.strictEqual(result, '96598765432');
    });

    it('prepends when number has unknown prefix', () => {
      const coverage = [{ prefix: '965' }];
      const result = prependCountryCode('98765432', '965', coverage);
      assert.strictEqual(result, '96598765432');
    });

    it('prepends default for KSA local number after zero strip', () => {
      const result = prependCountryCode('587469874', '966', []);
      assert.strictEqual(result, '966587469874');
    });

    it('does not prepend if findCountryCode finds a match (empty coverage)', () => {
      const result = prependCountryCode('96598765432', '965', []);
      assert.strictEqual(result, '96598765432');
    });

    it('prepends for UAE local number', () => {
      const result = prependCountryCode('501234567', '971', []);
      assert.strictEqual(result, '971501234567');
    });
  });
});

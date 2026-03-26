import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { renderTemplate } from '../src/services/templates';

describe('Template Service', () => {
  it('replaces placeholders in English template', () => {
    const body = 'Hi {{customer_name}}, your order {{order_id}} is confirmed.';
    const result = renderTemplate(body, {
      customer_name: 'Ahmad',
      order_id: 'ORD-123',
    });
    assert.strictEqual(result, 'Hi Ahmad, your order ORD-123 is confirmed.');
  });

  it('replaces placeholders in Arabic template', () => {
    const body = 'مرحبا {{customer_name}}، تم تأكيد طلبك {{order_id}}.';
    const result = renderTemplate(body, {
      customer_name: 'أحمد',
      order_id: 'ORD-456',
    });
    assert.strictEqual(result, 'مرحبا أحمد، تم تأكيد طلبك ORD-456.');
  });

  it('replaces missing placeholders with empty string', () => {
    const body = 'Hi {{customer_name}}, order {{order_id}}.';
    const result = renderTemplate(body, { customer_name: 'Ahmad' });
    assert.strictEqual(result, 'Hi Ahmad, order .');
  });

  it('handles template with no placeholders', () => {
    const body = 'Hello, this is a plain message.';
    const result = renderTemplate(body, {});
    assert.strictEqual(result, 'Hello, this is a plain message.');
  });

  it('handles empty data object', () => {
    const body = '{{greeting}} {{name}}';
    const result = renderTemplate(body, {});
    assert.strictEqual(result, ' ');
  });

  it('selects correct language body', () => {
    const template = {
      body_en: 'Hello {{name}}',
      body_ar: 'مرحبا {{name}}',
    };
    const en = renderTemplate(template.body_en, { name: 'Ahmad' });
    const ar = renderTemplate(template.body_ar, { name: 'أحمد' });
    assert.strictEqual(en, 'Hello Ahmad');
    assert.strictEqual(ar, 'مرحبا أحمد');
  });
});

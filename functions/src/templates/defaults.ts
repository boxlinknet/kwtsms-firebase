/**
 * Default Template Definitions
 *
 * Seeded into Firestore on extension install. System templates cannot be
 * deleted or disabled. Body text can be edited and reverted to defaults.
 *
 * Related files:
 *   - services/templates.ts: renders templates
 *   - lifecycle/on-install.ts: seeds these into Firestore
 */

export interface TemplateDefinition {
  name: string;
  description: string;
  body_en: string;
  body_ar: string;
  placeholders: string[];
}

export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'welcome',
    description: 'Sent when a new user signs up with a phone number',
    body_en: 'Welcome to {{app_name}}! Your account is ready.',
    body_ar: 'مرحبا بك في {{app_name}}! حسابك جاهز.',
    placeholders: ['app_name'],
  },
  {
    name: 'otp',
    description: 'OTP verification code',
    body_en: 'Your {{app_name}} verification code is: {{code}}. Valid for {{expiry_minutes}} minutes.',
    body_ar: 'رمز التحقق الخاص بك في {{app_name}} هو: {{code}}. صالح لمدة {{expiry_minutes}} دقائق.',
    placeholders: ['app_name', 'code', 'expiry_minutes'],
  },
  {
    name: 'order_confirmed',
    description: 'Sent when an order is placed',
    body_en: 'Hi {{customer_name}}, your order {{order_id}} has been confirmed.',
    body_ar: 'مرحبا {{customer_name}}، تم تأكيد طلبك {{order_id}}.',
    placeholders: ['customer_name', 'order_id'],
  },
  {
    name: 'order_shipped',
    description: 'Sent when an order is shipped',
    body_en: 'Hi {{customer_name}}, your order {{order_id}} has been shipped.',
    body_ar: 'مرحبا {{customer_name}}، تم شحن طلبك {{order_id}}.',
    placeholders: ['customer_name', 'order_id'],
  },
  {
    name: 'order_delivered',
    description: 'Sent when an order is delivered',
    body_en: 'Hi {{customer_name}}, your order {{order_id}} has been delivered.',
    body_ar: 'مرحبا {{customer_name}}، تم توصيل طلبك {{order_id}}.',
    placeholders: ['customer_name', 'order_id'],
  },
  {
    name: 'status_update',
    description: 'Sent on generic order status change',
    body_en: 'Hi {{customer_name}}, your order {{order_id}} status: {{status}}.',
    body_ar: 'مرحبا {{customer_name}}، حالة طلبك {{order_id}}: {{status}}.',
    placeholders: ['customer_name', 'order_id', 'status'],
  },
  {
    name: 'reminder',
    description: 'Generic reminder message',
    body_en: 'Hi {{customer_name}}, reminder: {{reminder_text}}',
    body_ar: 'مرحبا {{customer_name}}، تذكير: {{reminder_text}}',
    placeholders: ['customer_name', 'reminder_text'],
  },
  {
    name: 'custom',
    description: 'Freeform message with no fixed template',
    body_en: '{{message}}',
    body_ar: '{{message}}',
    placeholders: ['message'],
  },
];

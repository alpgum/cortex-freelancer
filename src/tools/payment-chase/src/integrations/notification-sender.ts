import { ChaseChannel, Client } from '../types';

export interface NotificationSender {
  send(
    channel: ChaseChannel,
    client: Client,
    message: { subject?: string; body: string }
  ): Promise<{ delivered: boolean; messageId?: string }>;
}

/**
 * Default sender for tests/demos. Marks as delivered without sending.
 */
export class NoopNotificationSender implements NotificationSender {
  async send(): Promise<{ delivered: boolean; messageId?: string }> {
    return { delivered: true, messageId: 'noop' };
  }
}

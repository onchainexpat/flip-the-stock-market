import type { Address } from 'viem';
import type { ErrorType } from './openOceanErrorHandler';

export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_EXECUTED = 'ORDER_EXECUTED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_FAILED = 'ORDER_FAILED',
  ORDER_EXPIRED = 'ORDER_EXPIRED',
  SERVICE_DEGRADED = 'SERVICE_DEGRADED',
  SERVICE_RESTORED = 'SERVICE_RESTORED',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION',
  RATE_LIMIT_WARNING = 'RATE_LIMIT_WARNING',
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  userAddress: Address;
  orderHash?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  read: boolean;
  actionRequired: boolean;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  type: 'toast' | 'email' | 'push' | 'webhook';
  enabled: boolean;
  config?: Record<string, any>;
}

/**
 * Notification service for OpenOcean DCA operations
 * Handles user notifications, admin alerts, and system status updates
 */
export class OpenOceanNotificationService {
  private notifications: Map<string, Notification> = new Map();
  private userChannels: Map<Address, NotificationChannel[]> = new Map();
  private adminChannels: NotificationChannel[] = [];
  private notificationTemplates: Map<
    NotificationType,
    (data: any) => {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error' | 'success';
    }
  > = new Map();

  constructor() {
    this.setupNotificationTemplates();
    this.setupDefaultChannels();
  }

  /**
   * Send notification to user
   */
  async sendUserNotification(
    userAddress: Address,
    type: NotificationType,
    data?: any,
  ): Promise<void> {
    const notification = this.createNotification(userAddress, type, data);

    // Store notification
    this.notifications.set(notification.id, notification);

    // Send via configured channels
    const channels =
      this.userChannels.get(userAddress) || this.getDefaultChannels();
    await this.sendToChannels(notification, channels);

    // Log notification
    console.log(
      `User notification sent: ${notification.title} to ${userAddress}`,
    );
  }

  /**
   * Send admin notification
   */
  async sendAdminNotification(
    type: NotificationType,
    data?: any,
  ): Promise<void> {
    const notification = this.createNotification(
      '0x0000000000000000000000000000000000000000' as Address,
      type,
      data,
    );

    // Store notification
    this.notifications.set(notification.id, notification);

    // Send via admin channels
    await this.sendToChannels(notification, this.adminChannels);

    // Log notification
    console.log(`Admin notification sent: ${notification.title}`);
  }

  /**
   * Handle order creation notification
   */
  async notifyOrderCreated(
    userAddress: Address,
    orderHash: string,
    orderData: any,
  ): Promise<void> {
    await this.sendUserNotification(
      userAddress,
      NotificationType.ORDER_CREATED,
      {
        orderHash,
        orderData,
        totalAmount: orderData.totalAmount,
        numberOfBuys: orderData.numberOfBuys,
        intervalHours: orderData.intervalHours,
      },
    );
  }

  /**
   * Handle order execution notification
   */
  async notifyOrderExecuted(
    userAddress: Address,
    orderHash: string,
    executionData: any,
  ): Promise<void> {
    await this.sendUserNotification(
      userAddress,
      NotificationType.ORDER_EXECUTED,
      {
        orderHash,
        executionData,
        executionCount: executionData.executionCount,
        amountExecuted: executionData.amountExecuted,
        remainingAmount: executionData.remainingAmount,
      },
    );
  }

  /**
   * Handle order cancellation notification
   */
  async notifyOrderCancelled(
    userAddress: Address,
    orderHash: string,
    reason?: string,
  ): Promise<void> {
    await this.sendUserNotification(
      userAddress,
      NotificationType.ORDER_CANCELLED,
      {
        orderHash,
        reason,
        timestamp: Date.now(),
      },
    );
  }

  /**
   * Handle order completion notification
   */
  async notifyOrderCompleted(
    userAddress: Address,
    orderHash: string,
    completionData: any,
  ): Promise<void> {
    await this.sendUserNotification(
      userAddress,
      NotificationType.ORDER_COMPLETED,
      {
        orderHash,
        completionData,
        totalExecutions: completionData.totalExecutions,
        totalAmount: completionData.totalAmount,
        averagePrice: completionData.averagePrice,
      },
    );
  }

  /**
   * Handle order failure notification
   */
  async notifyOrderFailed(
    userAddress: Address,
    orderHash: string,
    error: Error,
    retryCount: number,
  ): Promise<void> {
    await this.sendUserNotification(
      userAddress,
      NotificationType.ORDER_FAILED,
      {
        orderHash,
        error: error.message,
        retryCount,
        timestamp: Date.now(),
      },
    );
  }

  /**
   * Handle manual intervention notification
   */
  async notifyManualInterventionRequired(
    userAddress: Address,
    orderHash: string,
    reason: string,
  ): Promise<void> {
    // Notify user
    await this.sendUserNotification(
      userAddress,
      NotificationType.MANUAL_INTERVENTION,
      {
        orderHash,
        reason,
        actionRequired: true,
      },
    );

    // Notify admins
    await this.sendAdminNotification(NotificationType.MANUAL_INTERVENTION, {
      userAddress,
      orderHash,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle service degradation notification
   */
  async notifyServiceDegraded(
    service: string,
    errorType: ErrorType,
    errorCount: number,
  ): Promise<void> {
    // Notify admins
    await this.sendAdminNotification(NotificationType.SERVICE_DEGRADED, {
      service,
      errorType,
      errorCount,
      timestamp: Date.now(),
    });

    // If critical, notify all users
    if (errorCount > 10) {
      // This would typically be sent to all active users
      console.warn(`Critical service degradation: ${service} - ${errorType}`);
    }
  }

  /**
   * Handle rate limit warning notification
   */
  async notifyRateLimitWarning(
    endpoint: string,
    currentRate: number,
    limit: number,
  ): Promise<void> {
    await this.sendAdminNotification(NotificationType.RATE_LIMIT_WARNING, {
      endpoint,
      currentRate,
      limit,
      usage: (currentRate / limit) * 100,
      timestamp: Date.now(),
    });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userAddress: Address,
    unreadOnly = false,
  ): Promise<Notification[]> {
    const userNotifications = Array.from(this.notifications.values())
      .filter((n) => n.userAddress === userAddress)
      .filter((n) => !unreadOnly || !n.read)
      .sort((a, b) => b.timestamp - a.timestamp);

    return userNotifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      this.notifications.set(notificationId, notification);
    }
  }

  /**
   * Configure user notification channels
   */
  async configureUserChannels(
    userAddress: Address,
    channels: NotificationChannel[],
  ): Promise<void> {
    this.userChannels.set(userAddress, channels);
  }

  /**
   * Create notification
   */
  private createNotification(
    userAddress: Address,
    type: NotificationType,
    data?: any,
  ): Notification {
    const template = this.notificationTemplates.get(type);
    if (!template) {
      throw new Error(`No template found for notification type: ${type}`);
    }

    const { title, message, severity } = template(data);

    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      userAddress,
      orderHash: data?.orderHash,
      severity,
      timestamp: Date.now(),
      read: false,
      actionRequired: type === NotificationType.MANUAL_INTERVENTION,
      metadata: data,
    };
  }

  /**
   * Send notification to channels
   */
  private async sendToChannels(
    notification: Notification,
    channels: NotificationChannel[],
  ): Promise<void> {
    const enabledChannels = channels.filter((c) => c.enabled);

    for (const channel of enabledChannels) {
      try {
        await this.sendToChannel(notification, channel);
      } catch (error) {
        console.error(
          `Failed to send notification via ${channel.type}:`,
          error,
        );
      }
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(
    notification: Notification,
    channel: NotificationChannel,
  ): Promise<void> {
    switch (channel.type) {
      case 'toast':
        // This would integrate with a toast notification system
        console.log(`Toast notification: ${notification.title}`);
        break;

      case 'email':
        // This would integrate with an email service
        console.log(
          `Email notification to ${notification.userAddress}: ${notification.title}`,
        );
        break;

      case 'push':
        // This would integrate with a push notification service
        console.log(`Push notification: ${notification.title}`);
        break;

      case 'webhook':
        // This would send to a configured webhook
        if (channel.config?.url) {
          try {
            await fetch(channel.config.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notification),
            });
          } catch (error) {
            console.error('Webhook notification failed:', error);
          }
        }
        break;
    }
  }

  /**
   * Setup notification templates
   */
  private setupNotificationTemplates(): void {
    this.notificationTemplates.set(NotificationType.ORDER_CREATED, (data) => ({
      title: 'DCA Order Created',
      message: `Your DCA order has been created successfully. Order hash: ${data.orderHash.slice(0, 8)}... Total: $${data.totalAmount} over ${data.numberOfBuys} buys.`,
      severity: 'success',
    }));

    this.notificationTemplates.set(NotificationType.ORDER_EXECUTED, (data) => ({
      title: 'DCA Order Executed',
      message: `DCA execution #${data.executionCount} completed. Amount: $${data.amountExecuted}. Remaining: $${data.remainingAmount}.`,
      severity: 'info',
    }));

    this.notificationTemplates.set(
      NotificationType.ORDER_CANCELLED,
      (data) => ({
        title: 'DCA Order Cancelled',
        message: `Your DCA order has been cancelled. ${data.reason ? `Reason: ${data.reason}` : ''}`,
        severity: 'warning',
      }),
    );

    this.notificationTemplates.set(
      NotificationType.ORDER_COMPLETED,
      (data) => ({
        title: 'DCA Order Completed',
        message: `Your DCA order has completed successfully! Total executions: ${data.totalExecutions}. Total amount: $${data.totalAmount}.`,
        severity: 'success',
      }),
    );

    this.notificationTemplates.set(NotificationType.ORDER_FAILED, (data) => ({
      title: 'DCA Order Failed',
      message: `Your DCA order failed to execute. Error: ${data.error}. Retry count: ${data.retryCount}.`,
      severity: 'error',
    }));

    this.notificationTemplates.set(NotificationType.ORDER_EXPIRED, (data) => ({
      title: 'DCA Order Expired',
      message: `Your DCA order has expired. Order hash: ${data.orderHash.slice(0, 8)}...`,
      severity: 'warning',
    }));

    this.notificationTemplates.set(
      NotificationType.MANUAL_INTERVENTION,
      (data) => ({
        title: 'Manual Intervention Required',
        message: `Your DCA order requires manual intervention. Reason: ${data.reason}. Please check your dashboard.`,
        severity: 'error',
      }),
    );

    this.notificationTemplates.set(
      NotificationType.SERVICE_DEGRADED,
      (data) => ({
        title: 'Service Degraded',
        message: `Service ${data.service} is experiencing issues. Error type: ${data.errorType}. Error count: ${data.errorCount}.`,
        severity: 'error',
      }),
    );

    this.notificationTemplates.set(
      NotificationType.SERVICE_RESTORED,
      (data) => ({
        title: 'Service Restored',
        message: `Service ${data.service} has been restored and is operating normally.`,
        severity: 'success',
      }),
    );

    this.notificationTemplates.set(
      NotificationType.RATE_LIMIT_WARNING,
      (data) => ({
        title: 'Rate Limit Warning',
        message: `Endpoint ${data.endpoint} is approaching rate limit. Current: ${data.currentRate}/${data.limit} (${data.usage.toFixed(1)}%).`,
        severity: 'warning',
      }),
    );
  }

  /**
   * Setup default channels
   */
  private setupDefaultChannels(): void {
    this.adminChannels = [
      { type: 'toast', enabled: true },
      { type: 'webhook', enabled: false, config: { url: '' } },
    ];
  }

  /**
   * Get default channels for users
   */
  private getDefaultChannels(): NotificationChannel[] {
    return [
      { type: 'toast', enabled: true },
      { type: 'push', enabled: false },
    ];
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    totalNotifications: number;
    notificationsByType: Record<NotificationType, number>;
    notificationsBySeverity: Record<string, number>;
    unreadCount: number;
    recentNotifications: Notification[];
  } {
    const notifications = Array.from(this.notifications.values());

    const notificationsByType = notifications.reduce(
      (acc, notification) => {
        acc[notification.type] = (acc[notification.type] || 0) + 1;
        return acc;
      },
      {} as Record<NotificationType, number>,
    );

    const notificationsBySeverity = notifications.reduce(
      (acc, notification) => {
        acc[notification.severity] = (acc[notification.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const unreadCount = notifications.filter((n) => !n.read).length;
    const recentNotifications = notifications
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      totalNotifications: notifications.length,
      notificationsByType,
      notificationsBySeverity,
      unreadCount,
      recentNotifications,
    };
  }

  /**
   * Clear old notifications
   */
  clearOldNotifications(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;

    for (const [id, notification] of this.notifications.entries()) {
      if (notification.timestamp < cutoff) {
        this.notifications.delete(id);
      }
    }
  }
}

// Export singleton instance
export const openOceanNotificationService = new OpenOceanNotificationService();

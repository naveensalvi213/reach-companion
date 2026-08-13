import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api_service.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    
    const initSettings = InitializationSettings(android: androidInit, iOS: iosInit);
    
    await _notificationsPlugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
      onDidReceiveBackgroundNotificationResponse: _onBackgroundNotificationAction,
    );

    // Request permissions for Android 13+
    await _notificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  // Handle tap on the main notification body (opens post context link)
  static void _onNotificationTap(NotificationResponse response) async {
    final payload = response.payload;
    if (payload != null) {
      try {
        final post = json.decode(payload) as Map<String, dynamic>;
        final postUrl = post['postUrl'] as String?;
        if (postUrl != null && postUrl.isNotEmpty) {
          final uri = Uri.parse(postUrl);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        }
      } catch (e) {
        print('Notification tap action error: $e');
      }
    }
  }

  // Handle action buttons (DMs, comments) even in the background
  @pragma('vm:entry-point')
  static void _onBackgroundNotificationAction(NotificationResponse response) async {
    final payload = response.payload;
    if (payload == null) return;
    
    try {
      final post = json.decode(payload) as Map<String, dynamic>;
      final actionId = response.actionId; // 'dm', 'comment', or 'both'
      
      if (actionId != null && (actionId == 'dm' || actionId == 'comment' || actionId == 'both')) {
        print('Executing background notification action: $actionId for post: ${post['id']}');
        await ApiService.executeAction(post, actionId);
        // Mark post as read since the user responded to it
        await ApiService.markAsRead([post['id']]);
      }
    } catch (e) {
      print('Background notification action error: $e');
    }
  }

  static Future<void> showPostNotification(Map<String, dynamic> post) async {
    final payload = json.encode(post);
    final isReddit = post['platform'] == 'reddit';
    final platformName = isReddit ? 'Reddit' : 'X (Twitter)';
    final author = post['userProfile']?['name'] ?? 'User';
    final handle = post['userProfile']?['handle'] ?? '';
    final text = post['text'] ?? '';

    // Truncate text for notification preview
    final previewText = text.length > 80 ? '${text.substring(0, 80)}...' : text;

    final List<AndroidNotificationAction> actions = [];
    if (isReddit) {
      actions.add(const AndroidNotificationAction('comment', '💬 Reply Comment', showsUserInterface: true));
    } else {
      actions.addAll([
        const AndroidNotificationAction('dm', '✉️ Send DM', showsUserInterface: true),
        const AndroidNotificationAction('comment', '💬 Reply Comment', showsUserInterface: true),
      ]);
    }

    final androidDetails = AndroidNotificationDetails(
      'reach_posts_channel',
      'Discovered Posts',
      channelDescription: 'Notifications for new discovered posts matching your keywords',
      importance: Importance.max,
      priority: Priority.high,
      actions: actions,
      styleInformation: BigTextStyleInformation(
        'Platform: $platformName\nAuthor: $author ($handle)\n\n$text',
        contentTitle: 'New Lead Found on $platformName',
        summaryText: '$author is looking for editors',
      ),
    );

    final iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentSound: true,
      presentBadge: true,
    );

    final details = NotificationDetails(android: androidDetails, iOS: iosDetails);
    
    // Hash post ID string to a unique integer ID for local notification manager
    final notificationId = post['id'].hashCode;
    
    await _notificationsPlugin.show(
      notificationId,
      'New Lead Found on $platformName',
      '$author ($handle): $previewText',
      details,
      payload: payload,
    );
  }
}

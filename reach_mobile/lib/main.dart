import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:workmanager/workmanager.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'screens/inbox_screen.dart';

// Unique task identifier for background sync
const String backgroundSyncTask = "com.antigravity.reach.syncTask";

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    print("WorkManager: Background task executor trigger: $task");
    
    // Initialize Local Notifications inside the background task context
    await NotificationService.init();

    try {
      // 1. Fetch latest inbox posts from PC desktop server
      final posts = await ApiService.fetchInboxPosts();
      
      // 2. Identify un-notified posts
      final List<Map<String, dynamic>> newLeads = [];
      final List<String> idsToUpdate = [];

      for (var p in posts) {
        final postMap = p as Map<String, dynamic>;
        final notified = postMap['notified'] == true;
        final isRead = postMap['isRead'] == true;
        
        if (!notified && !isRead) {
          newLeads.add(postMap);
          idsToUpdate.add(postMap['id']);
        }
      }

      print("WorkManager: Found ${newLeads.length} new unnotified leads.");

      // 3. Trigger local notifications for each new lead
      for (var lead in newLeads) {
        await NotificationService.showPostNotification(lead);
      }

      // 4. Update PC backend to mark these posts as notified so we don't notify again
      if (idsToUpdate.isNotEmpty) {
        await ApiService.markAsRead(idsToUpdate);
      }
      
      return Future.value(true);
    } catch (e) {
      print("WorkManager Background Sync Error: $e");
      return Future.value(false);
    }
  });
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize push notification settings
  await NotificationService.init();

  // WorkManager only supports mobile platforms (Android/iOS)
  if (Platform.isAndroid || Platform.isIOS) {
    // Register background WorkManager dispatcher
    await Workmanager().initialize(
      callbackDispatcher,
      isInDebugMode: false,
    );

    // Register periodic background sync task (runs every 15 minutes - Android minimum)
    await Workmanager().registerPeriodicTask(
      "1",
      backgroundSyncTask,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected, // Only run when internet is active (automatically pauses when data is off)
      ),
    );
  }

  runApp(const ReachCompanionApp());
}

class ReachCompanionApp extends StatelessWidget {
  const ReachCompanionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Reach Companion',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const InboxScreen(),
    );
  }
}

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String _defaultIp = '192.168.1.100'; // Default placeholder, user configures this
  
  static Future<String> getBackendUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final ip = prefs.getString('backend_ip') ?? _defaultIp;
    return 'http://$ip:3001';
  }

  static Future<List<dynamic>> fetchInboxPosts() async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.get(Uri.parse('$baseUrl/api/inbox-posts'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['posts'] ?? [];
      }
    } catch (e) {
      print('ApiService Error: $e');
    }
    return [];
  }

  static Future<bool> markAsRead(List<String> ids) async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.post(
        Uri.parse('$baseUrl/api/inbox-posts/read'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'ids': ids}),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('ApiService Error: $e');
    }
    return false;
  }

  static Future<Map<String, dynamic>> fetchConfig() async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.get(Uri.parse('$baseUrl/api/config'));
      if (response.statusCode == 200) {
        return json.decode(response.body) as Map<String, dynamic>;
      }
    } catch (e) {
      print('ApiService Error: $e');
    }
    return {'keywords': [], 'excludes': [], 'intervalMinutes': 5};
  }

  static Future<bool> saveConfig(Map<String, dynamic> config) async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.post(
        Uri.parse('$baseUrl/api/config'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(config),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('ApiService Error: $e');
    }
    return false;
  }

  static Future<bool> executeAction(Map<String, dynamic> post, String action) async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.post(
        Uri.parse('$baseUrl/api/send-dms'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'posts': [post],
          'xAction': action // 'dm', 'comment', or 'both'
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('ApiService Error: $e');
    }
    return false;
  }

  static Future<List<dynamic>> fetchTemplates() async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.get(Uri.parse('$baseUrl/api/templates'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['templates'] ?? [];
      }
    } catch (e) {
      print('ApiService Error: $e');
    }
    return [];
  }

  static Future<bool> addTemplate(String text, String? keyword) async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.post(
        Uri.parse('$baseUrl/api/templates'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'text': text,
          'keyword': keyword != null && keyword.trim().isNotEmpty ? keyword.trim() : null,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('ApiService Error: $e');
    }
    return false;
  }

  static Future<bool> editTemplate(String id, String text, String? keyword) async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.put(
        Uri.parse('$baseUrl/api/templates/$id'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'text': text,
          'keyword': keyword != null && keyword.trim().isNotEmpty ? keyword.trim() : null,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('ApiService Error: $e');
    }
    return false;
  }

  static Future<bool> deleteTemplate(String id) async {
    try {
      final baseUrl = await getBackendUrl();
      final response = await http.delete(Uri.parse('$baseUrl/api/templates/$id'));
      return response.statusCode == 200;
    } catch (e) {
      print('ApiService Error: $e');
    }
    return false;
  }
}

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import 'settings_screen.dart';
import 'templates_screen.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<dynamic> _posts = [];
  bool _isLoading = false;
  final Set<String> _selectedPostIds = {};
  String _platformFilter = 'all'; // 'all', 'twitter', 'reddit'
  String _xActionConfig = 'both'; // 'dm', 'comment', 'both'

  @override
  void initState() {
    super.initState();
    _refreshInbox();
  }

  Future<void> _refreshInbox() async {
    setState(() {
      _isLoading = true;
    });
    final posts = await ApiService.fetchInboxPosts();
    setState(() {
      _posts = posts;
      _isLoading = false;
    });
  }

  Future<void> _markSelectedAsRead() async {
    if (_selectedPostIds.isEmpty) return;
    final ids = _selectedPostIds.toList();
    final success = await ApiService.markAsRead(ids);
    if (success) {
      setState(() {
        for (var post in _posts) {
          if (_selectedPostIds.contains(post['id'])) {
            post['isRead'] = true;
          }
        }
        _selectedPostIds.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Marked selected posts as read')),
      );
    }
  }

  Future<void> _executeBulkAction() async {
    if (_selectedPostIds.isEmpty) return;
    final selectedPosts = _posts.where((p) => _selectedPostIds.contains(p['id'])).toList();
    
    setState(() {
      _isLoading = true;
    });

    int successCount = 0;
    for (var post in selectedPosts) {
      final success = await ApiService.executeAction(post, _xActionConfig);
      if (success) successCount++;
    }

    // Mark all as read
    await ApiService.markAsRead(_selectedPostIds.toList());
    
    setState(() {
      _selectedPostIds.clear();
    });
    
    await _refreshInbox();
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Successfully processed $successCount/${selectedPosts.length} actions!')),
    );
  }

  void _openPostLink(String? url) async {
    if (url != null && url.isNotEmpty) {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Filter posts
    final filteredPosts = _posts.where((post) {
      if (_platformFilter == 'all') return true;
      return post['platform'] == _platformFilter;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Sleek deep dark mode slate
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Text(
          'Reach Companion',
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5, color: Colors.white),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _refreshInbox,
          ),
          IconButton(
            icon: const Icon(Icons.description, color: Colors.white),
            tooltip: 'Templates',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const TemplatesScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              ).then((_) => _refreshInbox());
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs Bar
          Container(
            color: const Color(0xFF1E293B),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
            child: Row(
              children: [
                _buildFilterButton('All', 'all'),
                const SizedBox(width: 8),
                _buildFilterButton('X (Twitter)', 'twitter'),
                const SizedBox(width: 8),
                _buildFilterButton('Reddit', 'reddit'),
              ],
            ),
          ),

          // Bulk action panel
          if (_selectedPostIds.isNotEmpty) _buildBulkActionPanel(),

          // Inbox Posts Feed
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
                : filteredPosts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.inbox_outlined, size: 64, color: Colors.grey.shade600),
                            const SizedBox(height: 16),
                            Text(
                              'No matching posts in your inbox',
                              style: TextStyle(color: Colors.grey.shade400, fontSize: 16),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: filteredPosts.length,
                        itemBuilder: (context, index) {
                          final post = filteredPosts[index];
                          final isSelected = _selectedPostIds.contains(post['id']);
                          final isRead = post['isRead'] == true;
                          return _buildPostCard(post, isSelected, isRead);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterButton(String label, String value) {
    final isSelected = _platformFilter == value;
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: isSelected ? const Color(0xFF6366F1) : const Color(0xFF334155),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
      onPressed: () {
        setState(() {
          _platformFilter = value;
        });
      },
      child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }

  Widget _buildBulkActionPanel() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Color(0x336366F1), // Glassy tint
        border: Border(bottom: BorderSide(color: Color(0x4D6366F1), width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Selected ${_selectedPostIds.length} posts',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          Row(
            children: [
              if (_platformFilter == 'all' || _platformFilter == 'twitter') ...[
                DropdownButton<String>(
                  value: _xActionConfig,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  underline: Container(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _xActionConfig = val;
                      });
                    }
                  },
                  items: const [
                    DropdownMenuItem(value: 'dm', child: Text('DM Only')),
                    DropdownMenuItem(value: 'comment', child: Text('Comment Only')),
                    DropdownMenuItem(value: 'both', child: Text('Both (DM & Comment)')),
                  ],
                ),
                const SizedBox(width: 8),
              ],
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                ),
                onPressed: _executeBulkAction,
                child: const Text('Execute', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.done_all, color: Colors.white70),
                tooltip: 'Mark read',
                onPressed: _markSelectedAsRead,
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white70),
                onPressed: () {
                  setState(() {
                    _selectedPostIds.clear();
                  });
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPostCard(Map<String, dynamic> post, bool isSelected, bool isRead) {
    final isReddit = post['platform'] == 'reddit';
    final author = post['userProfile']?['name'] ?? 'User';
    final handle = post['userProfile']?['handle'] ?? '';
    final avatar = post['userProfile']?['image'] ?? '';
    final text = post['text'] ?? '';
    final timeStr = post['time'] != null ? DateTime.parse(post['time']).toLocal().toString().substring(0, 16) : '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected ? const Color(0xFF6366F1) : (isRead ? Colors.transparent : const Color(0x336366F1)),
          width: isSelected ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card Header
            Row(
              children: [
                Checkbox(
                  value: isSelected,
                  activeColor: const Color(0xFF6366F1),
                  onChanged: (val) {
                    setState(() {
                      if (val == true) {
                        _selectedPostIds.add(post['id']);
                      } else {
                        _selectedPostIds.remove(post['id']);
                      }
                    });
                  },
                ),
                CircleAvatar(
                  radius: 18,
                  backgroundImage: avatar.isNotEmpty && avatar.startsWith('http')
                      ? NetworkImage(avatar)
                      : null,
                  backgroundColor: const Color(0xFF334155),
                  child: avatar.isEmpty || !avatar.startsWith('http')
                      ? Text(author.substring(0, 1).toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                      : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        author,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        handle,
                        style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // Platform Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isReddit ? const Color(0x26FF4500) : const Color(0x261DA1F2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: isReddit ? const Color(0xFFFF4500) : const Color(0xFF1DA1F2), width: 0.5),
                  ),
                  child: Text(
                    isReddit ? 'Reddit' : 'X (Twitter)',
                    style: TextStyle(
                      color: isReddit ? const Color(0xFFFF4500) : const Color(0xFF1DA1F2),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Card Content text (clamp to max 3 lines as requested in previous parts)
            Text(
              text,
              style: const TextStyle(color: Colors.white70, fontSize: 13.5, height: 1.4),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            // Footer (Time & Link actions)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  timeStr,
                  style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                ),
                Row(
                  children: [
                    TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: () => _openPostLink(post['postUrl']),
                      child: const Text('View Post', style: TextStyle(fontSize: 12, color: Color(0xFF6366F1), fontWeight: FontWeight.bold)),
                    ),
                    if (post['dmUrl'] != null) ...[
                      const SizedBox(width: 8),
                      TextButton(
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () => _openPostLink(post['dmUrl']),
                        child: const Text('Send DM', style: TextStyle(fontSize: 12, color: Color(0xFF6366F1), fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

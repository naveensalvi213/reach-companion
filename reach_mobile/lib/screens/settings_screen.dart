import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _ipController = TextEditingController();
  final _keywordController = TextEditingController();
  final _excludeController = TextEditingController();
  final _intervalController = TextEditingController();
  final _commentDelayController = TextEditingController();
  
  List<String> _keywords = [];
  List<String> _excludes = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadLocalConfig();
  }

  Future<void> _loadLocalConfig() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _ipController.text = prefs.getString('backend_ip') ?? '192.168.1.100';
    });
    _fetchBackendConfig();
  }

  Future<void> _fetchBackendConfig() async {
    setState(() {
      _isLoading = true;
    });
    final config = await ApiService.fetchConfig();
    setState(() {
      _keywords = List<String>.from(config['keywords'] ?? []);
      _excludes = List<String>.from(config['excludes'] ?? []);
      _intervalController.text = (config['intervalMinutes'] ?? 5).toString();
      _commentDelayController.text = (config['commentDelay'] ?? 0).toString();
      _isLoading = false;
    });
  }

  Future<void> _saveConfig() async {
    setState(() {
      _isLoading = true;
    });
    
    // Save IP locally
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('backend_ip', _ipController.text.trim());

    final interval = int.tryParse(_intervalController.text.trim()) ?? 5;
    final delay = int.tryParse(_commentDelayController.text.trim()) ?? 0;

    // Save configuration parameters to desktop backend
    final success = await ApiService.saveConfig({
      'keywords': _keywords,
      'excludes': _excludes,
      'intervalMinutes': interval,
      'commentDelay': delay,
    });

    setState(() {
      _isLoading = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success 
          ? 'Configuration successfully saved to backend!' 
          : 'Failed to sync config with backend. IP may be incorrect.'),
      ),
    );
  }

  void _addKeyword() {
    final text = _keywordController.text.trim();
    if (text.isNotEmpty && !_keywords.contains(text)) {
      setState(() {
        _keywords.add(text);
        _keywordController.clear();
      });
    }
  }

  void _addExclude() {
    final text = _excludeController.text.trim();
    if (text.isNotEmpty && !_excludes.contains(text)) {
      setState(() {
        _excludes.add(text);
        _excludeController.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Settings', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // PC IP Settings Card
                  _buildSectionHeader('Desktop Server Setup'),
                  Card(
                    color: const Color(0xFF1E293B),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          TextField(
                            controller: _ipController,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              labelText: 'PC Backend Local IP Address',
                              labelStyle: TextStyle(color: Colors.white70),
                              hintText: 'e.g. 192.168.1.100',
                              hintStyle: TextStyle(color: Colors.white30),
                              enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF6366F1))),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Ensure your phone and PC are connected to the same Wi-Fi network.',
                            style: TextStyle(color: Colors.grey.shade400, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Background Scheduler Interval & Comment Delay
                  _buildSectionHeader('Scheduler & Delay Configuration'),
                  Card(
                    color: const Color(0xFF1E293B),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          TextField(
                            controller: _intervalController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              labelText: 'Search Polling Interval (Minutes)',
                              labelStyle: TextStyle(color: Colors.white70),
                              hintText: 'e.g. 5',
                              hintStyle: TextStyle(color: Colors.white30),
                              enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF6366F1))),
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _commentDelayController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(
                              labelText: 'Comment / DM Delay (Minutes)',
                              labelStyle: TextStyle(color: Colors.white70),
                              hintText: 'e.g. 1',
                              hintStyle: TextStyle(color: Colors.white30),
                              enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF6366F1))),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Keywords Search
                  _buildSectionHeader('Keywords to Search'),
                  Card(
                    color: const Color(0xFF1E293B),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _keywordController,
                                  style: const TextStyle(color: Colors.white),
                                  decoration: const InputDecoration(
                                    labelText: 'Add Keyword',
                                    labelStyle: TextStyle(color: Colors.white70),
                                    enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                                    focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF6366F1))),
                                  ),
                                  onSubmitted: (_) => _addKeyword(),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.add_circle, color: Color(0xFF6366F1)),
                                onPressed: _addKeyword,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _keywords.map((tag) => Chip(
                              label: Text(tag, style: const TextStyle(color: Colors.white, fontSize: 12)),
                              backgroundColor: const Color(0xFF334155),
                              deleteIconColor: Colors.white70,
                              onDeleted: () {
                                setState(() {
                                  _keywords.remove(tag);
                                });
                              },
                            )).toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Excluded Keywords
                  _buildSectionHeader('Keywords to Exclude'),
                  Card(
                    color: const Color(0xFF1E293B),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _excludeController,
                                  style: const TextStyle(color: Colors.white),
                                  decoration: const InputDecoration(
                                    labelText: 'Add Exclude Keyword',
                                    labelStyle: TextStyle(color: Colors.white70),
                                    enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                                    focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF6366F1))),
                                  ),
                                  onSubmitted: (_) => _addExclude(),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.add_circle, color: Colors.redAccent),
                                onPressed: _addExclude,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _excludes.map((tag) => Chip(
                              label: Text(tag, style: const TextStyle(color: Colors.white, fontSize: 12)),
                              backgroundColor: const Color(0x33EF4444),
                              side: const BorderSide(color: Colors.redAccent, width: 0.5),
                              deleteIconColor: Colors.white70,
                              onDeleted: () {
                                setState(() {
                                  _excludes.remove(tag);
                                });
                              },
                            )).toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Save configuration button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _saveConfig,
                      child: const Text(
                        'Save & Synchronize Config',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: Color(0xFF6366F1),
          fontWeight: FontWeight.bold,
          fontSize: 13,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

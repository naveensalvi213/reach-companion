import { useState, useEffect } from 'react'
import './index.css'

const highlightKeywords = (text, keywords) => {
  if (!text || !keywords || keywords.length === 0) return text;
  
  const escapedKeywords = keywords
    .map(k => k.trim())
    .filter(k => k)
    .map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  
  if (escapedKeywords.length === 0) return text;
  
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    const isMatch = regex.test(part);
    return isMatch ? (
      <span key={i} style={{ color: '#EF4444', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '0 0.2rem', borderRadius: '3px' }}>
        {part}
      </span>
    ) : part;
  });
};

function App() {
  const [keywordsList, setKeywordsList] = useState(() => {
    const saved = localStorage.getItem('keywordsList');
    return saved ? JSON.parse(saved) : [];
  })
  const [excludeList, setExcludeList] = useState(() => {
    const saved = localStorage.getItem('excludeList');
    return saved ? JSON.parse(saved) : [];
  })
  const [keywordInput, setKeywordInput] = useState('')
  const [excludeInput, setExcludeInput] = useState('')
  
  const [hours, setHours] = useState(24)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(5)
  const [commentDelay, setCommentDelay] = useState(0)
  const [editingTemplateId, setEditingTemplateId] = useState(null)

  // DM Templates and Selection State
  const [templates, setTemplates] = useState([])
  const [newTemplateText, setNewTemplateText] = useState('')
  const [newTemplateKeyword, setNewTemplateKeyword] = useState('')
  const [selectedPostIds, setSelectedPostIds] = useState([])
  const [sendingDms, setSendingDms] = useState(false)
  const [xActionConfig, setXActionConfig] = useState(() => {
    return localStorage.getItem('xActionConfig') || 'both'; // default to 'both'
  })

  // Inbox & Tabs state
  const [inboxMessages, setInboxMessages] = useState([])
  const [activeTab, setActiveTab] = useState('search') // 'search', 'leads', or 'inbox'
  const [fetchingInbox, setFetchingInbox] = useState(false)

  // Profiles State
  const [profiles, setProfiles] = useState(['default'])
  const [activeProfile, setActiveProfile] = useState('default')
  const [showAddProfileInput, setShowAddProfileInput] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')

  // Leads state
  const [leads, setLeads] = useState([])
  const [fetchingLeads, setFetchingLeads] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState(null)

  // Token Management State
  const [tokensData, setTokensData] = useState({ activeTwitterTokenId: null, activeRedditTokenId: null, tokens: [] })
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenValue, setNewTokenValue] = useState('')
  const [newTwitterCt0, setNewTwitterCt0] = useState('')
  const [newTokenType, setNewTokenType] = useState('twitter') // 'twitter' or 'reddit'

  // Persist include/exclude tags to localStorage on change
  useEffect(() => {
    localStorage.setItem('keywordsList', JSON.stringify(keywordsList));
  }, [keywordsList])

  useEffect(() => {
    localStorage.setItem('excludeList', JSON.stringify(excludeList));
  }, [excludeList])

  useEffect(() => {
    fetchProfiles()
    fetchTokens()
    fetchTemplates()
    fetchInbox()
    fetchConfig()
    fetchLeads()
  }, [])

  const fetchProfiles = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/profiles')
      const data = await response.json()
      setProfiles(data.profiles || ['default'])
      setActiveProfile(data.activeProfile || 'default')
    } catch (err) {
      console.error("Failed to fetch profiles", err)
    }
  }

  const handleSwitchProfile = async (profileName) => {
    try {
      const response = await fetch('http://localhost:3001/api/profiles/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName })
      })
      const data = await response.json()
      setActiveProfile(data.activeProfile)
      
      fetchTokens()
      fetchTemplates()
      fetchInbox()
      fetchConfig()
      fetchLeads()
    } catch (err) {
      console.error("Failed to switch profile", err)
      alert("Error switching profile.")
    }
  }

  const handleCreateProfile = async (name) => {
    if (!name || !name.trim()) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })
      const data = await response.json()
      if (response.ok) {
        setProfiles(data.profiles)
        setActiveProfile(data.activeProfile)
        
        fetchTokens()
        fetchTemplates()
        fetchInbox()
        fetchConfig()
        fetchLeads()
      } else {
        alert(data.error || "Failed to create profile.")
      }
    } catch (err) {
      console.error("Failed to create profile", err)
      alert("Error creating profile.")
    }
  }

  const handleExportData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export-data');
      const data = await response.json();
      const jsonStr = JSON.stringify(data, null, 2);
      
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reach_companion_backup_${data.activeProfile || 'data'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data', err);
      alert('Failed to export data');
    }
  }

  const handleImportData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      const res = await fetch('http://localhost:3001/api/import-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      });
      if (res.ok) {
        alert('All data imported successfully!');
        fetchTokens();
        fetchTemplates();
        fetchInbox();
        fetchConfig();
        fetchLeads();
      } else {
        alert('Import failed.');
      }
    } catch (err) {
      console.error('Failed to import data', err);
      alert('Invalid backup JSON file.');
    }
  }

  const fetchTokens = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/tokens')
      const data = await response.json()
      setTokensData(data)
    } catch (err) {
      console.error("Failed to fetch tokens", err)
    }
  }

  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/config')
      const data = await response.json()
      if (data.keywords && data.keywords.length > 0) {
        setKeywordsList(data.keywords)
      }
      if (data.excludes) {
        setExcludeList(data.excludes)
      }
      if (data.intervalMinutes !== undefined) {
        setIntervalMinutes(data.intervalMinutes)
      }
      if (data.commentDelay !== undefined) {
        setCommentDelay(data.commentDelay)
      }
    } catch (err) {
      console.error("Failed to fetch config from backend", err)
    }
  }

  const fetchLeads = async (force = false) => {
    setFetchingLeads(true);
    try {
      const url = force ? 'http://localhost:3001/api/inbox-posts?refresh=true' : 'http://localhost:3001/api/inbox-posts';
      const response = await fetch(url);
      const data = await response.json();
      setLeads(data.posts || []);
    } catch (err) {
      console.error("Failed to fetch discovered leads:", err);
    } finally {
      setFetchingLeads(false);
    }
  };

  const handleMarkLeadAsRead = async (id) => {
    try {
      await fetch('http://localhost:3001/api/inbox-posts/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, isRead: true } : l));
    } catch (err) {
      console.error("Failed to mark lead as read:", err);
    }
  };

  useEffect(() => {
    window.handleNotificationClick = async (postId) => {
      setActiveTab('leads');
      try {
        const response = await fetch('http://localhost:3001/api/inbox-posts');
        const data = await response.json();
        const posts = data.posts || [];
        setLeads(posts);
        if (postId) {
          setSelectedLeadId(postId);
          // Highlight it, mark it read on backend
          await fetch('http://localhost:3001/api/inbox-posts/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [postId] })
          });
          setLeads(posts.map(l => l.id === postId ? { ...l, isRead: true } : l));
          // Scroll to the card
          setTimeout(() => {
            const el = document.getElementById(`lead-card-${postId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      } catch (err) {
        console.error("Error handling notification click:", err);
      }
    };
  }, []);

  const handleAddToken = async (e) => {
    e.preventDefault()
    if (!newTokenValue.trim()) return

    try {
      const response = await fetch('http://localhost:3001/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          label: newTokenLabel, 
          value: newTokenValue, 
          type: newTokenType,
          ct0: newTokenType === 'twitter' ? newTwitterCt0 : undefined
        })
      })
      const data = await response.json()
      setTokensData(data)
      setNewTokenLabel('')
      setNewTokenValue('')
      setNewTwitterCt0('')
    } catch (err) {
      console.error("Failed to add token", err)
    }
  }

  const handleDeleteToken = async (id) => {
    try {
      const response = await fetch(`http://localhost:3001/api/tokens/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      setTokensData(data)
    } catch (err) {
      console.error("Failed to delete token", err)
    }
  }

  const handleSetActiveToken = async (id, type) => {
    try {
      const response = await fetch('http://localhost:3001/api/tokens/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type })
      })
      const data = await response.json()
      setTokensData(data)
    } catch (err) {
      console.error("Failed to set active token", err)
    }
  }

  const handleOpenLink = async (e, url) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:3001/api/open-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
    } catch (err) {
      console.error("Failed to open link natively", err);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error("Failed to fetch templates", err)
    }
  }

  const handleAddTemplate = async (e) => {
    e.preventDefault()
    if (!newTemplateText.trim()) return
    try {
      let url = 'http://localhost:3001/api/templates';
      let method = 'POST';
      if (editingTemplateId) {
        url = `http://localhost:3001/api/templates/${editingTemplateId}`;
        method = 'PUT';
      }
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: newTemplateText,
          keyword: newTemplateKeyword ? newTemplateKeyword.trim() : undefined
        })
      })
      const data = await response.json()
      setTemplates(data.templates || [])
      setNewTemplateText('')
      setNewTemplateKeyword('')
      setEditingTemplateId(null)
    } catch (err) {
      console.error("Failed to save template", err)
    }
  }

  const handleStartEditTemplate = (template) => {
    setEditingTemplateId(template.id)
    setNewTemplateText(template.text)
    setNewTemplateKeyword(template.keyword || '')
  }

  const handleCancelEditTemplate = () => {
    setEditingTemplateId(null)
    setNewTemplateText('')
    setNewTemplateKeyword('')
  }

  const handleDeleteTemplate = async (id) => {
    try {
      const response = await fetch(`http://localhost:3001/api/templates/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error("Failed to delete template", err)
    }
  }

  const toggleSelectPost = (id) => {
    if (selectedPostIds.includes(id)) {
      setSelectedPostIds(selectedPostIds.filter(pid => pid !== id));
    } else {
      setSelectedPostIds([...selectedPostIds, id]);
    }
  }

  const handleSendDms = async () => {
    if (selectedPostIds.length === 0) return;
    if (templates.length === 0) {
      alert("Please add at least one DM template in settings first.");
      return;
    }
    
    const selectedPosts = results.filter(p => selectedPostIds.includes(p.id));
    
    setSendingDms(true);
    try {
      const response = await fetch('http://localhost:3001/api/send-dms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: selectedPosts, xAction: xActionConfig })
      });
      const data = await response.json();
      
      if (response.ok) {
        let successCount = 0;
        let failMsgs = [];
        data.results.forEach(res => {
          if (res.status === 'sent') successCount++;
          else failMsgs.push(`${res.id}: ${res.error}`);
        });
        alert(`DMs dispatched successfully to ${successCount}/${selectedPosts.length} users.${failMsgs.length > 0 ? '\n\nFailures:\n' + failMsgs.join('\n') : ''}`);
        setSelectedPostIds([]);
      } else {
        alert(data.error || "Failed to dispatch DMs.");
      }
    } catch (err) {
      console.error("Failed to send DMs", err);
      alert("Network error sending DMs.");
    } finally {
      setSendingDms(false);
    }
  }

  const handleSingleAction = async (post, actionType) => {
    if (templates.length === 0) {
      alert("Please add at least one DM template in settings first.");
      return;
    }
    setSendingDms(true);
    try {
      const response = await fetch('http://localhost:3001/api/send-dms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: [post],
          xAction: actionType
        })
      });
      const data = await response.json();
      
      if (response.ok && data.results && data.results.length > 0) {
        const res = data.results[0];
        if (res.status === 'sent') {
          alert(`Action executed successfully for ${post.userProfile?.name || 'User'}!`);
        } else {
          alert(`Failed: ${res.error || 'Unknown error'}`);
        }
      } else {
        alert(data.error || "Failed to execute action.");
      }
    } catch (err) {
      console.error("Failed to execute action:", err);
      alert("Network error executing action.");
    } finally {
      setSendingDms(false);
    }
  }

  const fetchInbox = async () => {
    setFetchingInbox(true);
    try {
      const response = await fetch('http://localhost:3001/api/inbox')
      const data = await response.json()
      setInboxMessages(data.messages || [])
    } catch (err) {
      console.error("Failed to fetch inbox notifications:", err)
    } finally {
      setFetchingInbox(false);
    }
  }

  const syncConfigWithBackend = async (kList, eList, interval = intervalMinutes, delay = commentDelay) => {
    try {
      await fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: kList,
          excludes: eList,
          intervalMinutes: parseInt(interval) || 5,
          commentDelay: parseInt(delay) || 0
        })
      });
    } catch (err) {
      console.error("Failed to sync config with backend:", err);
    }
  }

  const handleAddKeyword = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = keywordInput.trim();
      if (val && !keywordsList.includes(val)) {
        const nextList = [...keywordsList, val];
        setKeywordsList(nextList);
        setKeywordInput('');
        syncConfigWithBackend(nextList, excludeList);
      }
    }
  }

  const handleRemoveKeyword = (index) => {
    const nextList = keywordsList.filter((_, i) => i !== index);
    setKeywordsList(nextList);
    syncConfigWithBackend(nextList, excludeList);
  }

  const handleAddExclude = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = excludeInput.trim();
      if (val && !excludeList.includes(val)) {
        const nextList = [...excludeList, val];
        setExcludeList(nextList);
        setExcludeInput('');
        syncConfigWithBackend(keywordsList, nextList);
      }
    }
  }

  const handleRemoveExclude = (index) => {
    const nextList = excludeList.filter((_, i) => i !== index);
    setExcludeList(nextList);
    syncConfigWithBackend(keywordsList, nextList);
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    
    // Fallback to input text if list is empty
    let finalKeywords = [...keywordsList];
    if (finalKeywords.length === 0 && keywordInput.trim()) {
      finalKeywords.push(keywordInput.trim());
    }
    
    if (finalKeywords.length === 0) return

    setLoading(true)
    try {
      const keywordQuery = finalKeywords.join(',');
      const excludeQuery = excludeList.join(',');
      const response = await fetch(`http://localhost:3001/api/search?keyword=${encodeURIComponent(keywordQuery)}&excludes=${encodeURIComponent(excludeQuery)}&hours=${hours}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error("Error fetching data:", error)
      alert("Failed to fetch data. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString();
  }

  const twitterTokens = tokensData.tokens.filter(t => t.type === 'twitter' || !t.type); // fallback for legacy
  const redditTokens = tokensData.tokens.filter(t => t.type === 'reddit');

  return (
    <div className="app-container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <h1>HiringRadar</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>👤 Profile:</span>
            {!showAddProfileInput ? (
              <>
                <select 
                  value={activeProfile} 
                  onChange={(e) => handleSwitchProfile(e.target.value)}
                  style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {profiles.map(p => (
                    <option key={p} value={p} style={{ background: '#0F172A', color: 'white' }}>{p}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setShowAddProfileInput(true)} 
                  title="Add New Profile"
                  style={{ margin: 0, padding: '0.1rem 0.3rem', fontSize: '0.75rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '20px', width: '20px' }}
                >
                  ＋
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input 
                  type="text" 
                  placeholder="Profile name..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '0.85rem', padding: '0.15rem 0.4rem', borderRadius: '4px', width: '120px', margin: 0, height: 'auto', outline: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateProfile(newProfileName);
                      setShowAddProfileInput(false);
                      setNewProfileName('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    handleCreateProfile(newProfileName);
                    setShowAddProfileInput(false);
                    setNewProfileName('');
                  }}
                  title="Save Profile"
                  style={{ margin: 0, padding: '0.1rem 0.3rem', fontSize: '0.75rem', background: '#10B981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '20px', width: '20px', fontWeight: 'bold' }}
                >
                  ✓
                </button>
                <button 
                  onClick={() => {
                    setShowAddProfileInput(false);
                    setNewProfileName('');
                  }}
                  title="Cancel"
                  style={{ margin: 0, padding: '0.1rem 0.3rem', fontSize: '0.75rem', background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '20px', width: '20px', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            onClick={handleExportData} 
            className="btn-small"
            title="Export all API keys, cookies, templates, keywords & data"
            style={{ background: '#10B981', color: 'white', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem' }}
          >
            📤 Share / Export All Data
          </button>
          
          <label 
            className="btn-small" 
            title="Import Backup Data"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.45rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem', margin: 0 }}
          >
            📥 Import
            <input type="file" accept=".json" onChange={handleImportData} style={{ display: 'none' }} />
          </label>

          <button 
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? 'Hide Settings' : '⚙️ Settings (Auth)'}
          </button>
        </div>
      </div>
      
      {showSettings && (
        <div className="glass-container settings-panel">
          <h2>Authentication Credentials</h2>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>
            <strong>X (Twitter):</strong> Go to x.com → Press F12 → Application → Cookies → copy <code>auth_token</code> and <code>ct0</code> values and enter them separately below.
          </p>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem'}}>
            <strong>Reddit:</strong> Go to reddit.com → Press F12 → Application → Cookies → copy the <code>reddit_session</code> value.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Twitter List */}
            <div>
              <h3>X (Twitter) Tokens</h3>
              <div className="token-list">
                {twitterTokens.length === 0 && (
                  <p style={{color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem'}}>No Twitter tokens.</p>
                )}
                {twitterTokens.map(token => (
                  <div key={token.id} className={`token-item ${tokensData.activeTwitterTokenId === token.id ? 'active' : ''}`}>
                    <div className="token-info">
                      <span className="token-label">{token.label}</span>
                      <span className="token-value">
                        {token.value.substring(0, 8)}...
                      </span>
                      {tokensData.activeTwitterTokenId === token.id && (
                        <span style={{color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold'}}>Active</span>
                      )}
                    </div>
                    <div className="token-actions">
                      {tokensData.activeTwitterTokenId !== token.id && (
                        <button className="btn-small btn-outline" onClick={() => handleSetActiveToken(token.id, 'twitter')}>Set Active</button>
                      )}
                      <button className="btn-small btn-danger" onClick={() => handleDeleteToken(token.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reddit List */}
            <div>
              <h3>Reddit Tokens</h3>
              <div className="token-list">
                {redditTokens.length === 0 && (
                  <p style={{color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem'}}>No Reddit tokens.</p>
                )}
                {redditTokens.map(token => (
                  <div key={token.id} className={`token-item ${tokensData.activeRedditTokenId === token.id ? 'active' : ''}`}>
                    <div className="token-info">
                      <span className="token-label">{token.label}</span>
                      <span className="token-value">
                        {token.value.substring(0, 8)}...
                      </span>
                      {tokensData.activeRedditTokenId === token.id && (
                        <span style={{color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold'}}>Active</span>
                      )}
                    </div>
                    <div className="token-actions">
                      {tokensData.activeRedditTokenId !== token.id && (
                        <button className="btn-small btn-outline" onClick={() => handleSetActiveToken(token.id, 'reddit')}>Set Active</button>
                      )}
                      <button className="btn-small btn-danger" onClick={() => handleDeleteToken(token.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form className="add-token-form" onSubmit={handleAddToken} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <div className="input-group" style={{ width: '120px' }}>
              <label>Platform</label>
              <select value={newTokenType} onChange={(e) => setNewTokenType(e.target.value)} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                <option value="twitter">X (Twitter)</option>
                <option value="reddit">Reddit</option>
              </select>
            </div>
            <div className="input-group">
              <label>Label</label>
              <input 
                type="text" 
                placeholder="e.g. Account 1" 
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
              />
            </div>
            <div className="input-group" style={{flex: 1.5}}>
              <label>{newTokenType === 'twitter' ? 'auth_token' : 'reddit_session'}</label>
              <input 
                type="text" 
                placeholder={newTokenType === 'twitter' ? 'Paste auth_token cookie here...' : 'Paste reddit_session cookie here...'} 
                value={newTokenValue}
                onChange={(e) => setNewTokenValue(e.target.value)}
                required
              />
            </div>
            {newTokenType === 'twitter' && (
              <div className="input-group" style={{flex: 1.5}}>
                <label>ct0 (CSRF Token)</label>
                <input 
                  type="text" 
                  placeholder="Paste ct0 cookie here..." 
                  value={newTwitterCt0}
                  onChange={(e) => setNewTwitterCt0(e.target.value)}
                  required
                />
              </div>
            )}
            <button type="submit" className="btn-small" style={{ alignSelf: 'end', marginBottom: '0.2rem' }}>Add Cookie</button>
          </form>

          {/* DM Templates Section inside Settings Panel */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
            <h3>Direct Message Templates</h3>
            <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem'}}>
              Add multiple template variations. The system will randomly pick one to personalize when sending a DM. <br/>
              Use placeholders: <code>{"{username}"}</code> for author name, <code>{"{handle}"}</code> for account screen name.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
              {/* Add template form */}
              <form onSubmit={handleAddTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="input-group">
                  <label htmlFor="templateText">Template Text</label>
                  <textarea
                    id="templateText"
                    rows="4"
                    placeholder="Hello {username}, I saw you are looking for a video editor..."
                    value={newTemplateText}
                    onChange={(e) => setNewTemplateText(e.target.value)}
                    style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', resize: 'vertical', fontFamily: 'inherit' }}
                    required
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="templateKeyword">Trigger Keyword (Optional)</label>
                  <input
                    type="text"
                    id="templateKeyword"
                    placeholder="e.g. thumbnail"
                    value={newTemplateKeyword}
                    onChange={(e) => setNewTemplateKeyword(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    This template will be chosen if a post contains this keyword.
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn-small" style={{ alignSelf: 'start' }}>
                    {editingTemplateId ? 'Save Changes' : 'Add Template'}
                  </button>
                  {editingTemplateId && (
                    <button type="button" className="btn-small btn-outline" onClick={handleCancelEditTemplate} style={{ alignSelf: 'start' }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Templates list */}
              <div>
                <label>Saved Templates ({templates.length})</label>
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {templates.length === 0 ? (
                    <p style={{color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem'}}>No templates added yet.</p>
                  ) : (
                    templates.map(t => (
                      <div key={t.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '4px', position: 'relative' }}>
                        <p style={{ fontSize: '0.85rem', margin: 0, paddingRight: '2.5rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{t.text}</p>
                        {t.keyword && (
                          <span style={{ display: 'inline-block', fontSize: '0.75rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginTop: '0.4rem', fontWeight: 'bold' }}>
                            🔑 Trigger: {t.keyword}
                          </span>
                        )}
                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn-small btn-outline" 
                            onClick={() => handleStartEditTemplate(t)} 
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn-small btn-danger" 
                            onClick={() => handleDeleteTemplate(t.id)} 
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="input-group">
              <label htmlFor="settingsInterval">Search Polling Interval (Minutes)</label>
              <input
                type="number"
                id="settingsInterval"
                min="1"
                placeholder="e.g. 5"
                value={intervalMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setIntervalMinutes(val);
                  syncConfigWithBackend(keywordsList, excludeList, val, commentDelay);
                }}
                style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                How frequently the backend searches X and Reddit (min. 1 min).
              </small>
            </div>
            <div className="input-group">
              <label htmlFor="settingsDelay">Comment Delay (Minutes)</label>
              <input
                type="number"
                id="settingsDelay"
                min="0"
                placeholder="e.g. 1"
                value={commentDelay}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setCommentDelay(val);
                  syncConfigWithBackend(keywordsList, excludeList, intervalMinutes, val);
                }}
                style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                Delay between successive comments/DMs to prevent rate limits.
              </small>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation header */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
        <button 
          onClick={() => setActiveTab('search')} 
          style={{ margin: 0, padding: '0.6rem 1.5rem', background: activeTab === 'search' ? 'var(--primary-color)' : 'transparent', border: activeTab === 'search' ? 'none' : '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', fontSize: '0.95rem' }}
        >
          🔍 Search & Reach
        </button>
        <button 
          onClick={() => { setActiveTab('leads'); fetchLeads(); }} 
          style={{ margin: 0, padding: '0.6rem 1.5rem', background: activeTab === 'leads' ? 'var(--primary-color)' : 'transparent', border: activeTab === 'leads' ? 'none' : '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          📢 Discovered Leads {leads.filter(l => !l.isRead).length > 0 && <span style={{ background: '#3b82f6', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>{leads.filter(l => !l.isRead).length}</span>}
        </button>
        <button 
          onClick={() => { setActiveTab('inbox'); fetchInbox(); }} 
          style={{ margin: 0, padding: '0.6rem 1.5rem', background: activeTab === 'inbox' ? 'var(--primary-color)' : 'transparent', border: activeTab === 'inbox' ? 'none' : '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          💬 Direct Replies {inboxMessages.filter(m => m.new).length > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>{inboxMessages.filter(m => m.new).length}</span>}
        </button>
      </div>

      {activeTab === 'search' && (
        <>
          <div className="glass-container">
            <form className="search-form" onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Include Keywords Tag Field */}
              <div className="input-group" style={{ width: '100%' }}>
                <label htmlFor="keyword">Keywords to Search (Press Enter to add)</label>
                <input 
                  type="text" 
                  id="keyword"
                  placeholder="Type keyword and press Enter..." 
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleAddKeyword}
                />
                {keywordsList.length > 0 && (
                  <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {keywordsList.map((tag, idx) => (
                      <span key={idx} className="tag tag-include" style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgb(99, 102, 241)', color: '#a5b4fc', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        {tag}
                        <button type="button" onClick={() => handleRemoveKeyword(idx)} style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 'bold' }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Exclude Keywords Tag Field */}
              <div className="input-group" style={{ width: '100%' }}>
                <label htmlFor="exclude">Keywords to Exclude (Press Enter to add)</label>
                <input 
                  type="text" 
                  id="exclude"
                  placeholder="Type keyword and press Enter..." 
                  value={excludeInput}
                  onChange={(e) => setExcludeInput(e.target.value)}
                  onKeyDown={handleAddExclude}
                />
                {excludeList.length > 0 && (
                  <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {excludeList.map((tag, idx) => (
                      <span key={idx} className="tag tag-exclude" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgb(239, 68, 68)', color: '#fca5a5', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        {tag}
                        <button type="button" onClick={() => handleRemoveExclude(idx)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 'bold' }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                <div className="input-group small" style={{ flex: 1 }}>
                  <label htmlFor="hours">Hours (Past)</label>
                  <input 
                    type="number" 
                    id="hours"
                    min="1"
                    max="720"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </div>
                
                <button type="submit" style={{ flex: 1, height: '42px' }}>Search</button>
              </div>
            </form>
          </div>

          <div className="results-container">
            {loading && <div className="loader"></div>}
            
            {!loading && results.map((result) => (
              <div 
                key={result.id} 
                className="result-card" 
                onClick={() => toggleSelectPost(result.id)}
                style={{ 
                  borderLeft: selectedPostIds.includes(result.id) ? '4px solid var(--primary-color)' : 'none', 
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                {/* DM Checkbox Selector */}
                <div 
                  style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedPostIds.includes(result.id)}
                    onChange={() => toggleSelectPost(result.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                  />
                </div>

                <div className="result-header" style={{ paddingLeft: '2rem' }}>
                  <div className="user-info">
                    <img src={result.userProfile.image} alt={result.userProfile.name} className="avatar" />
                    <div className="user-details">
                      <h3>{result.userProfile.name}</h3>
                      <span>{result.userProfile.handle}</span>
                    </div>
                  </div>
                  <div className={`platform-badge platform-${result.platform}`}>
                    {result.platform === 'twitter' ? 'X (Twitter)' : 'Reddit'}
                  </div>
                </div>
                
                <p className="post-text" style={{ paddingLeft: '2rem' }}>
                  {highlightKeywords(result.text, keywordsList)}
                </p>
                <span className="post-time" style={{ paddingLeft: '2rem' }}>{formatTime(result.time)}</span>
                
                <div 
                  className="actions" 
                  style={{ paddingLeft: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {result.platform === 'twitter' ? (
                    <>
                      <button className="action-btn dm-btn" onClick={() => handleSingleAction(result, 'dm')} disabled={sendingDms}>
                        ✉️ Send DM
                      </button>
                      <button className="action-btn comment-btn" style={{ background: '#10B981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => handleSingleAction(result, 'comment')} disabled={sendingDms}>
                        💬 Comment
                      </button>
                      <button className="action-btn both-btn" style={{ background: '#6366F1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => handleSingleAction(result, 'both')} disabled={sendingDms}>
                        ⚡ Both
                      </button>
                    </>
                  ) : (
                    <button className="action-btn dm-btn" onClick={() => handleSingleAction(result, 'dm')} disabled={sendingDms}>
                      ✉️ Send DM
                    </button>
                  )}
                  {result.postUrl && (
                    <button className="action-btn post-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }} onClick={(e) => handleOpenLink(e, result.postUrl)}>
                      🔗 View Post
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!loading && results.length === 0 && (keywordsList.length > 0 || keywordInput) && (
              <div className="glass-container" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No results found. Try adjusting your search.</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'leads' && (
        <div className="results-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Discovered Leads ({leads.length})</h2>
            <button className="btn-small btn-outline" style={{ margin: 0, padding: '0.4rem 1rem' }} onClick={() => fetchLeads(true)} disabled={fetchingLeads}>
              {fetchingLeads ? 'Refreshing...' : '🔄 Refresh Leads'}
            </button>
          </div>

          {fetchingLeads && <div className="loader"></div>}

          {!fetchingLeads && leads.length === 0 && (
            <div className="glass-container" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No discovered leads found. Ensure the background scheduler is running.</p>
            </div>
          )}

          {!fetchingLeads && leads.map((lead) => {
            const isSelected = selectedLeadId === lead.id;
            return (
              <div 
                key={lead.id} 
                id={`lead-card-${lead.id}`}
                className="result-card" 
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  if (!lead.isRead) handleMarkLeadAsRead(lead.id);
                }}
                style={{ 
                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--glass-bg)',
                  border: isSelected ? '2px solid var(--primary-color)' : !lead.isRead ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {!lead.isRead && (
                  <span style={{ position: 'absolute', top: '10px', right: '10px', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} title="New Lead" />
                )}
                
                <div className="result-header">
                  <div className="user-info">
                    <img src={lead.userProfile?.image || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'} alt={lead.userProfile?.name} className="avatar" />
                    <div className="user-details">
                      <h3>{lead.userProfile?.name || 'User'}</h3>
                      <span>{lead.userProfile?.handle || ''}</span>
                    </div>
                  </div>
                  <div className={`platform-badge platform-${lead.platform}`}>
                    {lead.platform === 'twitter' ? 'X (Twitter)' : 'Reddit'}
                  </div>
                </div>

                <p className="post-text" style={{ fontSize: '1.05rem', margin: '0.5rem 0' }}>
                  {highlightKeywords(lead.text, keywordsList)}
                </p>
                <span className="post-time">{formatTime(lead.time)}</span>

                <div className="actions" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {lead.platform === 'twitter' ? (
                    <>
                      <button className="action-btn dm-btn" onClick={(e) => { e.stopPropagation(); handleSingleAction(lead, 'dm'); }} disabled={sendingDms}>
                        ✉️ Send DM
                      </button>
                      <button className="action-btn comment-btn" style={{ background: '#10B981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); handleSingleAction(lead, 'comment'); }} disabled={sendingDms}>
                        💬 Comment
                      </button>
                      <button className="action-btn both-btn" style={{ background: '#6366F1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); handleSingleAction(lead, 'both'); }} disabled={sendingDms}>
                        ⚡ Both
                      </button>
                    </>
                  ) : (
                    <button className="action-btn dm-btn" onClick={(e) => { e.stopPropagation(); handleSingleAction(lead, 'dm'); }} disabled={sendingDms}>
                      ✉️ Send DM
                    </button>
                  )}
                  {lead.postUrl && (
                    <button className="action-btn post-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleOpenLink(e, lead.postUrl); }}>
                      🔗 View Post
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'inbox' && (
        /* Inbox Content Panel */
        <div className="results-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Notifications & Replies</h2>
            <button className="btn-small btn-outline" style={{ margin: 0, padding: '0.4rem 1rem' }} onClick={fetchInbox} disabled={fetchingInbox}>
              {fetchingInbox ? 'Refreshing...' : '🔄 Refresh Inbox'}
            </button>
          </div>

          {fetchingInbox && <div className="loader"></div>}

          {!fetchingInbox && inboxMessages.length === 0 && (
            <div className="glass-container" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No messages found in your inbox.</p>
            </div>
          )}

          {!fetchingInbox && inboxMessages.map((msg) => (
            <div key={msg.id} className="result-card" style={{ background: msg.new ? 'rgba(99, 102, 241, 0.08)' : 'var(--glass-bg)', border: msg.new ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--glass-border)' }}>
              <div className="result-header">
                <div className="user-info">
                  <div className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    {msg.author.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <h3>u/{msg.author}</h3>
                    <span style={{ color: msg.new ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: msg.new ? 'bold' : 'normal' }}>
                      {msg.subject} {msg.new && '(Unread)'}
                    </span>
                  </div>
                </div>
                <div className="platform-badge platform-reddit">
                  Reddit
                </div>
              </div>
              <p style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0.5rem 0 0.25rem 0', whiteSpace: 'pre-wrap' }}>
                {msg.body}
              </p>
              <span className="post-time">{formatTime(msg.time)}</span>
              <div className="actions" style={{ marginTop: '0.75rem' }}>
                <a href={msg.contextUrl} onClick={(e) => handleOpenLink(e, msg.contextUrl)} className="action-btn post-btn" style={{ flex: 'none', width: '200px' }}>
                  💬 Open Context / Reply
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Floating Bulk Execution Bar */}
      {selectedPostIds.length > 0 && (
        <div style={{ 
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '750px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '12px',
          padding: '0.85rem 1.5rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 9999,
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '0.95rem', color: 'white', fontWeight: 'bold' }}>
            ⚡ Selected <span style={{ color: 'var(--primary-color)' }}>{selectedPostIds.length}</span> post{selectedPostIds.length > 1 ? 's' : ''} for bulk outreach
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>X Action:</span>
              <select 
                value={xActionConfig} 
                onChange={(e) => {
                  setXActionConfig(e.target.value);
                  localStorage.setItem('xActionConfig', e.target.value);
                }}
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="dm" style={{ background: '#0f172a' }}>DM Only</option>
                <option value="comment" style={{ background: '#0f172a' }}>Comment Only</option>
                <option value="both" style={{ background: '#0f172a' }}>Both (DM & Comment)</option>
              </select>
            </div>

            <button 
              className="btn-small" 
              onClick={handleSendDms} 
              disabled={sendingDms}
              style={{ background: 'var(--primary-color)', color: 'white', margin: 0, padding: '0.5rem 1.25rem', borderRadius: '6px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
            >
              {sendingDms ? 'Outreaching...' : '⚡ Bulk Execute'}
            </button>
            <button 
              className="btn-small btn-outline" 
              onClick={() => setSelectedPostIds([])}
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)', margin: 0, padding: '0.5rem 1rem', borderRadius: '6px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

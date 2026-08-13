const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('os').platform() === 'win32' ? require('path').win32 : require('path');
const os = require('os');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve compiled static frontend at root
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const USER_DATA_DIR = path.join(os.homedir(), '.reach-companion');
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

const GLOBAL_STATE_FILE = path.join(USER_DATA_DIR, 'global_state.json');
const PROFILES_DIR = path.join(USER_DATA_DIR, 'profiles');

const getActiveProfile = () => {
  if (fs.existsSync(GLOBAL_STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(GLOBAL_STATE_FILE, 'utf-8'));
      if (state.activeProfile) return state.activeProfile;
    } catch (e) {}
  }
  return 'default';
};

const saveActiveProfile = (profile) => {
  try {
    fs.writeFileSync(GLOBAL_STATE_FILE, JSON.stringify({ activeProfile: profile }, null, 2));
  } catch (e) {}
};

let activeProfile = getActiveProfile();

const getProfilePath = (fileName) => {
  const profileDir = path.join(PROFILES_DIR, activeProfile);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return path.join(profileDir, fileName);
};

const getTokensFile = () => getProfilePath('tokens.json');
const getTemplatesFile = () => getProfilePath('templates.json');
const getDiscoveredPostsFile = () => getProfilePath('discovered_posts.json');
const getConfigFile = () => getProfilePath('config.json');

const migrateExistingToDefault = () => {
  const defaultDir = path.join(PROFILES_DIR, 'default');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  const files = ['config.json', 'tokens.json', 'templates.json', 'discovered_posts.json'];
  
  // Possible source directories for old user data
  const possibleSrcDirs = [
    'C:\\Users\\navee\\Downloads\\x & reddit\\backend',
    path.join(__dirname, '..'), // parent of backend (dev root)
    __dirname // backend directory
  ];

  files.forEach(f => {
    const dest = path.join(defaultDir, f);
    if (!fs.existsSync(dest)) {
      for (const srcDir of possibleSrcDirs) {
        const src = path.join(srcDir, f);
        if (fs.existsSync(src)) {
          try {
            fs.copyFileSync(src, dest);
            console.log(`Successfully migrated ${f} from ${src} to profiles/default/`);
            break; // copied successfully, move to next file
          } catch (err) {
            console.error(`Failed to migrate ${f} from ${src}:`, err);
          }
        }
      }
    }
  });
};

// Run migration on startup
migrateExistingToDefault();

// Helper to resolve paths on Windows/Unix
const home = os.homedir();
const isWin = os.platform() === 'win32';
const TWITTER_PATH = isWin
  ? path.join(home, '.agent-reach-venv', 'Scripts', 'twitter.exe')
  : path.join(home, '.agent-reach-venv', 'bin', 'twitter');
const REDDIT_PATH = isWin
  ? path.join(home, '.agent-reach-venv', 'Scripts', 'rdt.exe')
  : path.join(home, '.agent-reach-venv', 'bin', 'rdt');
const PYTHON_PATH = isWin
  ? path.join(home, '.agent-reach-venv', 'Scripts', 'python.exe')
  : path.join(home, '.agent-reach-venv', 'bin', 'python');

// Helper to read tokens with migration
const getTokensData = () => {
  const tokensFile = getTokensFile();
  if (!fs.existsSync(tokensFile)) {
    return { activeTwitterTokenId: null, activeRedditTokenId: null, tokens: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(tokensFile, 'utf-8'));
    // Migration logic
    if (data.activeTokenId && !data.activeTwitterTokenId) {
      data.activeTwitterTokenId = data.activeTokenId;
      delete data.activeTokenId;
    }
    if (!data.activeTwitterTokenId) data.activeTwitterTokenId = null;
    if (!data.activeRedditTokenId) data.activeRedditTokenId = null;
    if (!data.tokens) data.tokens = [];
    data.tokens.forEach(t => {
      if (!t.type) t.type = 'twitter';
    });
    return data;
  } catch (e) {
    return { activeTwitterTokenId: null, activeRedditTokenId: null, tokens: [] };
  }
};

const saveTokensData = (data) => {
  fs.writeFileSync(getTokensFile(), JSON.stringify(data, null, 2));
};

// Helper to parse cookies
const parseCookies = (cookieStr) => {
  const cookies = {};
  if (!cookieStr) return cookies;
  
  // If it's a simple token with no '=' or ';', treat it as a raw token
  if (!cookieStr.includes('=') && !cookieStr.includes(';')) {
    return { rawToken: cookieStr.trim() };
  }
  
  cookieStr.split(';').forEach(pair => {
    const parts = pair.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return cookies;
};

// --- Token Management Endpoints ---

app.get('/api/tokens', (req, res) => {
  res.json(getTokensData());
});

app.post('/api/tokens', (req, res) => {
  const { label, value, type, ct0 } = req.body;
  if (!value) return res.status(400).json({ error: 'Token value is required' });

  const data = getTokensData();
  const parsed = parseCookies(value);
  
  let tokenVal = value;
  let ct0Val = ct0 || '';
  
  if (type === 'reddit') {
    tokenVal = parsed.reddit_session || parsed.rawToken || value;
  } else {
    // Twitter/X
    tokenVal = parsed.auth_token || parsed.rawToken || value;
    if (!ct0Val && parsed.ct0) {
      ct0Val = parsed.ct0;
    }
  }

  const newToken = {
    id: Date.now().toString(),
    type: type || 'twitter',
    label: label || `${type === 'reddit' ? 'Reddit' : 'Twitter'} Token ${data.tokens.length + 1}`,
    value: tokenVal,
    ct0: ct0Val
  };
  
  data.tokens.push(newToken);
  
  if (type === 'reddit') {
    if (!data.activeRedditTokenId) data.activeRedditTokenId = newToken.id;
  } else {
    if (!data.activeTwitterTokenId) data.activeTwitterTokenId = newToken.id;
  }
  
  saveTokensData(data);
  res.json(data);
});

app.put('/api/tokens/active', (req, res) => {
  const { id, type } = req.body;
  const data = getTokensData();
  
  if (!data.tokens.find(t => t.id === id)) {
    return res.status(404).json({ error: 'Token not found' });
  }
  
  if (type === 'reddit') {
    data.activeRedditTokenId = id;
  } else {
    data.activeTwitterTokenId = id;
  }
  
  saveTokensData(data);
  res.json(data);
});

app.delete('/api/tokens/:id', (req, res) => {
  const { id } = req.params;
  const data = getTokensData();
  
  const tokenToDelete = data.tokens.find(t => t.id === id);
  data.tokens = data.tokens.filter(t => t.id !== id);
  
  if (tokenToDelete) {
    if (data.activeTwitterTokenId === id) {
      const nextTwitter = data.tokens.find(t => t.type === 'twitter');
      data.activeTwitterTokenId = nextTwitter ? nextTwitter.id : null;
    }
    if (data.activeRedditTokenId === id) {
      const nextReddit = data.tokens.find(t => t.type === 'reddit');
      data.activeRedditTokenId = nextReddit ? nextReddit.id : null;
    }
  }
  
  saveTokensData(data);
  res.json(data);
});

// Endpoint to natively open target links using OS default schemes
app.post('/api/open-link', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // On Windows, use 'start' command via shell execution to open links in their default registered apps (e.g. Twitter / Reddit native UWP apps if registered, otherwise default browser)
  const cmd = process.platform === 'win32' 
    ? `start "" "${url.replace(/&/g, '^&')}"` 
    : process.platform === 'darwin' 
      ? `open "${url}"` 
      : `xdg-open "${url}"`;

  const { exec } = require('child_process');
  exec(cmd, (err) => {
    if (err) {
      console.error('Failed to open link natively:', err);
      return res.status(500).json({ error: 'Failed to open link natively' });
    }
    res.json({ ok: true });
  });
});

const getTemplatesData = () => {
  const templatesFile = getTemplatesFile();
  if (!fs.existsSync(templatesFile)) {
    return { templates: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(templatesFile, 'utf-8'));
  } catch (e) {
    return { templates: [] };
  }
};

const saveTemplatesData = (data) => {
  fs.writeFileSync(getTemplatesFile(), JSON.stringify(data, null, 2));
};

// Templates API
app.get('/api/templates', (req, res) => {
  res.json(getTemplatesData());
});

app.post('/api/templates', (req, res) => {
  const { text, keyword } = req.body;
  if (!text) return res.status(400).json({ error: 'Template text is required' });
  const data = getTemplatesData();
  const newTemplate = { 
    id: Date.now().toString(), 
    text,
    keyword: keyword ? keyword.trim() : undefined
  };
  data.templates.push(newTemplate);
  saveTemplatesData(data);
  res.json(data);
});
app.put('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const { text, keyword } = req.body;
  if (!text) return res.status(400).json({ error: 'Template text is required' });
  
  const data = getTemplatesData();
  const template = data.templates.find(t => t.id === id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  
  template.text = text;
  template.keyword = keyword ? keyword.trim() : undefined;
  
  saveTemplatesData(data);
  res.json(data);
});
app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const data = getTemplatesData();
  data.templates = data.templates.filter(t => t.id !== id);
  saveTemplatesData(data);
  res.json(data);
});

// Inbox API
app.get('/api/inbox', async (req, res) => {
  const tokens = getTokensData();
  const activeReddit = tokens.tokens.find(t => t.id === tokens.activeRedditTokenId);
  if (!activeReddit || !activeReddit.value) {
    return res.json({ messages: [] });
  }

  try {
    const pyCode = `
import sys, json
from rdt_cli.client import RedditClient
from rdt_cli.auth import Credential
cred = Credential(cookies={"reddit_session": "${activeReddit.value}"}, source="manual")
with RedditClient(cred) as client:
    res = client._get('/message/comments.json', params={'raw_json': 1})
    print(json.dumps(res))
`;
    const args = ['-c', pyCode];
    const pythonPath = PYTHON_PATH;
    const envs = { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

    const { stdout, stderr, error } = await runCli(pythonPath, args, envs);
    if (error) {
      throw new Error(stderr || error.message);
    }

    const inboxData = JSON.parse(stdout);
    const children = inboxData?.data?.children || [];
    
    const messages = children.map(child => {
      const d = child.data;
      return {
        id: d.id,
        author: d.author || 'Reddit User',
        subject: d.subject || 'No Subject',
        body: d.body || '',
        new: d.new,
        time: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
        contextUrl: d.context ? `https://www.reddit.com${d.context}` : `https://www.reddit.com/message/messages/${d.id}`
      };
    });

    res.json({ messages });
  } catch (err) {
    console.error("Failed to fetch inbox:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DM Dispatch API
app.post('/api/send-dms', async (req, res) => {
  const { posts, xAction } = req.body; // Array of { platform, handle, name, text }, xAction: 'dm' | 'comment' | 'both'
  if (!Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: 'Posts array is required' });
  }

  const templatesData = getTemplatesData();
  if (templatesData.templates.length === 0) {
    return res.status(400).json({ error: 'Please add at least one DM template in settings first.' });
  }

  const tokens = getTokensData();
  const activeTwitter = tokens.tokens.find(t => t.id === tokens.activeTwitterTokenId);
  const activeReddit = tokens.tokens.find(t => t.id === tokens.activeRedditTokenId);

  const results = [];
  const cfg = getConfig();
  const delayMinutes = cfg.commentDelay || 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    // If it's not the first post and we have a delay, wait
    if (i > 0 && delayMinutes > 0) {
      console.log(`Waiting ${delayMinutes} minutes before next outreach action...`);
      await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
    }

    const postTextLower = (post.text || '').toLowerCase();
    const matchingTemplates = templatesData.templates.filter(t => 
      t.keyword && postTextLower.includes(t.keyword.trim().toLowerCase())
    );
    
    let templateObj;
    if (matchingTemplates.length > 0) {
      templateObj = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)];
      console.log(`Keyword Template Match: Found matching template for post ${post.id} (Keyword: "${templateObj.keyword}")`);
    } else {
      const fallbacks = templatesData.templates.filter(t => !t.keyword);
      const pool = fallbacks.length > 0 ? fallbacks : templatesData.templates;
      templateObj = pool[Math.floor(Math.random() * pool.length)];
    }
    
    let message = templateObj.text
      .replace(/{username}/g, post.userProfile?.name || '')
      .replace(/{handle}/g, post.userProfile?.handle || '');

    if (post.platform === 'reddit') {
      if (!activeReddit || !activeReddit.value) {
        results.push({ id: post.id, status: 'failed', error: 'No active Reddit token' });
        continue;
      }
      
      // Reddit message bypass: Since Reddit blocks oauth DMs from scripts, we execute a post comment on the post via the safe rdt.exe CLI binary instead.
      try {
        const username = post.userProfile.name;
        const postName = post.id.replace('reddit_', ''); // This is the bare post ID (e.g. 1uubxn5)
        console.log(`Reddit Comment Bypass: Posting comment to u/${username} on post ${postName}: "${message.substring(0, 30)}..."`);
        
        // Execute rdt comment <id_or_index> "<text>"
        const args = ['comment', postName, message];
        const envs = { 
          PYTHONIOENCODING: 'utf-8', 
          PYTHONUTF8: '1' 
        };

        const { stdout, stderr, error } = await runCli(REDDIT_PATH, args, envs);
        if (error) {
          throw new Error(stderr || error.message);
        }
        
        console.log(`Reddit CLI output: ${stdout.trim()}`);
        results.push({ id: post.id, status: 'sent' });
      } catch (err) {
        console.error(`Failed to post comment to Reddit user u/${post.userProfile.name}:`, err.message);
        results.push({ id: post.id, status: 'failed', error: err.message });
      }

    } else if (post.platform === 'twitter') {
      if (!activeTwitter || !activeTwitter.value) {
        results.push({ id: post.id, status: 'failed', error: 'No active X token' });
        continue;
      }

      const screenName = (post.userProfile?.handle || '').replace('@', '');
      const bareTweetId = post.id.replace('twitter_', '');
      
      const doDM = (xAction === 'dm' || xAction === 'both');
      const doComment = (xAction === 'comment' || xAction === 'both');

      console.log(`Twitter Action for ${screenName}: DM=${doDM}, Comment=${doComment}`);

      const pyCode = `
import sys, json
from twitter_cli.client import TwitterClient
client = TwitterClient(auth_token="${activeTwitter.value}", ct0="${activeTwitter.ct0 || ''}")

results = {}

if ${doDM ? 'True' : 'False'}:
    try:
        user = client.fetch_user("${screenName}")
        url = "https://x.com/i/api/1.1/direct_messages/events/new.json"
        payload = {
            "event": {
                "type": "message_create",
                "message_create": {
                    "target": {"recipient_id": user.id},
                    "message_data": {"text": ${JSON.stringify(message)}}
                }
            }
        }
        client._api_request(url, method="POST", body=payload)
        results["dm"] = "sent"
    except Exception as e:
        results["dm_error"] = str(e)

if ${doComment ? 'True' : 'False'}:
    try:
        # Create comment/reply on Twitter
        client.create_tweet(${JSON.stringify(message)}, reply_to_id="${bareTweetId}")
        results["comment"] = "sent"
    except Exception as e:
        results["comment_error"] = str(e)

print(json.dumps(results))
`;
      const args = ['-c', pyCode];
      const pythonPath = PYTHON_PATH;
      const envs = { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

      try {
        const { stdout, stderr, error } = await runCli(pythonPath, args, envs);
        if (error) {
          throw new Error(stderr || error.message);
        }
        const resp = JSON.parse(stdout);
        
        let errs = [];
        if (doDM && resp.dm_error) errs.push("DM: " + resp.dm_error);
        if (doComment && resp.comment_error) errs.push("Comment: " + resp.comment_error);

        if (errs.length > 0) {
          throw new Error(errs.join(', '));
        }

        results.push({ id: post.id, status: 'sent' });
      } catch (err) {
        console.error(`Failed X actions on user @${screenName}:`, err.message);
        results.push({ id: post.id, status: 'failed', error: err.message });
      }
    }
  }

  res.json({ results });
});

// --- CLI Execution Helper ---

const runCli = (file, args, envs = {}) => {
  return new Promise((resolve) => {
    execFile(file, args, {
      env: { ...process.env, ...envs },
      maxBuffer: 20 * 1024 * 1024 // 20MB
    }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error });
    });
  });
};

const parseKeywords = (keywordStr) => {
  const keywords = keywordStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  if (keywords.length === 0) return { keywords: [], redditQuery: '', twitterQuery: '' };
  
  // Format queries for CLI (rdt-cli and twitter-cli accept OR queries)
  const redditQuery = keywords.join(' OR ');
  const twitterQuery = keywords.join(' OR ');
  return { keywords, redditQuery, twitterQuery };
};

const containsAnyKeyword = (text, keywords) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  // Check if text contains any of the search keywords as case-insensitive substring
  return keywords.some(k => lowerText.includes(k));
};

// Write credentials file for rdt-cli
const writeRedditCredential = (sessionValue) => {
  const configDir = path.join(home, '.config', 'rdt-cli');
  const credentialFile = path.join(configDir, 'credential.json');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const cred = {
    cookies: {
      reddit_session: sessionValue
    },
    source: "manual",
    username: null,
    modhash: null,
    saved_at: Date.now() / 1000,
    last_verified_at: null
  };
  
  fs.writeFileSync(credentialFile, JSON.stringify(cred, null, 2), { mode: 0o600 });
};

// --- Scraper implementations via Agent-Reach ---

const scrapeTwitterCli = async (keywords, hours, tokenValue, ct0Value, excludeKeywords = []) => {
  if (!keywords || keywords.length === 0) return [];
  if (!tokenValue) {
    console.log("Twitter CLI: Skipping search because no auth token is active.");
    return [];
  }

  const allTweetsMap = new Map();
  const now = Date.now();
  const cutoffTime = now - (hours * 60 * 60 * 1000);

  for (const keyword of keywords) {
    // Add type latest to fetch recently created posts first
    const args = ['search', keyword, '--type', 'latest', '--json'];
    const envs = {
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      TWITTER_AUTH_TOKEN: tokenValue
    };
    if (ct0Value) {
      envs.TWITTER_CT0 = ct0Value;
    }

    try {
      console.log(`Twitter CLI: Searching for keyword "${keyword}" (latest)...`);
      const { stdout, stderr, error } = await runCli(TWITTER_PATH, args, envs);
      
      if (error) {
        console.error(`Twitter CLI search failed for "${keyword}":`, stderr || error.message);
        continue;
      }
      
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch (e) {
        console.error(`Twitter CLI: Failed to parse JSON for "${keyword}".`);
        continue;
      }
      
      let tweets = [];
      if (Array.isArray(parsed)) {
        tweets = parsed;
      } else if (parsed && parsed.ok === false) {
        console.error(`Twitter CLI returned error for "${keyword}":`, parsed.error);
        continue;
      } else if (parsed && Array.isArray(parsed.data)) {
        tweets = parsed.data;
      }

      console.log(`Twitter CLI: Got ${tweets.length} raw tweets for keyword "${keyword}"`);

      tweets.forEach(tweet => {
        const text = tweet.text || '';
        const lowerText = text.toLowerCase();

        // Apply exclude filter instantly
        const isExcluded = excludeKeywords.some(ex => lowerText.includes(ex));
        if (isExcluded) return;

        const isoString = tweet.createdAtISO || tweet.created_at;
        const postTime = isoString ? new Date(isoString).getTime() : 0;

        // Deduplicate and filter by hours cutoff time
        if (postTime >= cutoffTime) {
          const mappedTweet = {
            id: `twitter_${tweet.id}`,
            platform: 'twitter',
            time: isoString ? new Date(isoString).toISOString() : new Date().toISOString(),
            postTime,
            userProfile: {
              name: tweet.author?.name || 'Twitter User',
              handle: tweet.author?.screenName ? `@${tweet.author.screenName}` : '@twitter',
              image: tweet.author?.profileImageUrl || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'
            },
            text,
            postUrl: tweet.author?.screenName ? `https://x.com/${tweet.author.screenName}/status/${tweet.id}` : `https://x.com/status/${tweet.id}`,
            dmUrl: tweet.author?.screenName ? `https://x.com/messages/compose?recipient_id=${tweet.author.screenName}` : 'https://x.com/messages'
          };
          allTweetsMap.set(mappedTweet.id, mappedTweet);
        }
      });
    } catch (err) {
      console.error(`Twitter CLI Scraper crashed for keyword "${keyword}":`, err);
    }
  }

  const results = Array.from(allTweetsMap.values());
  // If the cutoffTime filtering removes all tweets due to timezone differences, fallback to returning the matching tweets directly
  if (results.length === 0 && allTweetsMap.size === 0) {
    console.log(`Twitter CLI: Search finished. Returning 0 items.`);
  }
  return results;
};

const scrapeRedditCli = async (keywords, hours, redditSession) => {
  if (!keywords || keywords.length === 0) return [];
  if (!redditSession) {
    console.log("Reddit CLI: Skipping search because no reddit_session cookie is active.");
    return [];
  }
  
  try {
    writeRedditCredential(redditSession);
  } catch (e) {
    console.error("Reddit CLI: Failed to write credentials file:", e);
    return [];
  }

  const allPostsMap = new Map();
  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

  // Search each keyword one-by-one
  for (const keyword of keywords) {
    // Sort by relevance, and filter time for 'day' (today) as requested
    const args = ['search', keyword, '--sort', 'relevance', '--time', 'day', '--json', '--compact'];
    const envs = {
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1'
    };
    
    try {
      console.log(`Reddit CLI: Searching for keyword "${keyword}" (sort: relevance, time: day)...`);
      const { stdout, stderr, error } = await runCli(REDDIT_PATH, args, envs);
      
      if (error) {
        console.error(`Reddit CLI error for "${keyword}":`, stderr || error.message);
        if (!stdout) continue;
      }
      
      let listing = null;
      try {
        listing = JSON.parse(stdout);
      } catch (e) {
        console.error(`Reddit CLI: Failed to parse JSON for "${keyword}". Stdout:`, stdout.substring(0, 500));
        continue;
      }
      
      if (listing && listing.ok === false) {
        console.error(`Reddit CLI returned error for "${keyword}":`, listing.error);
        continue;
      }
      
      let posts = [];
      if (Array.isArray(listing)) {
        posts = listing;
      } else if (listing && Array.isArray(listing.items)) {
        posts = listing.items;
      } else if (listing && Array.isArray(listing.data)) {
        posts = listing.data;
      } else {
        console.error(`Reddit CLI: Unexpected structure for "${keyword}":`, JSON.stringify(listing).substring(0, 200));
        continue;
      }
      
      console.log(`Reddit CLI: Got ${posts.length} posts for keyword "${keyword}"`);
      
      posts.forEach(post => {
        const postTime = post.created_utc * 1000;
        
        // Deduplicate and filter by hours cutoff time
        if (postTime >= cutoffTime) {
          const mappedPost = {
            id: `reddit_${post.id}`,
            platform: 'reddit',
            time: new Date(postTime).toISOString(),
            postTime,
            userProfile: {
              name: post.author,
              handle: `u/${post.author}`,
              image: 'https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png'
            },
            text: post.title + (post.selftext ? `\n${post.selftext}` : ''),
            postUrl: `https://www.reddit.com${post.permalink}`,
            dmUrl: `https://www.reddit.com/message/compose/?to=${post.author}`
          };
          allPostsMap.set(mappedPost.id, mappedPost);
        }
      });
    } catch (err) {
      console.error(`Reddit CLI Scraper crashed for keyword "${keyword}":`, err);
    }
  }

  const results = Array.from(allPostsMap.values());
  console.log(`Reddit CLI: Search finished. Returning ${results.length} unique posts across all keywords.`);
  return results;
};

const getDiscoveredPosts = () => {
  const discoveredFile = getDiscoveredPostsFile();
  if (!fs.existsSync(discoveredFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(discoveredFile, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const saveDiscoveredPosts = (posts) => {
  fs.writeFileSync(getDiscoveredPostsFile(), JSON.stringify(posts, null, 2));
};

const getConfig = () => {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile)) {
    return { 
      keywords: ['hiring video editor', 'need video editor', 'looking for editor', 'need thumbnail', 'looking for thumbnail', 'hiring thumbnail'], 
      excludes: ['?'], 
      intervalMinutes: 5,
      commentDelay: 0
    };
  }
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  } catch (e) {
    return { 
      keywords: ['hiring video editor', 'need video editor', 'looking for editor', 'need thumbnail', 'looking for thumbnail', 'hiring thumbnail'], 
      excludes: ['?'], 
      intervalMinutes: 5,
      commentDelay: 0
    };
  }
};

const saveConfig = (cfg) => {
  fs.writeFileSync(getConfigFile(), JSON.stringify(cfg, null, 2));
};

let bgIntervalId = null;

const runBackgroundSearch = async () => {
  const cfg = getConfig();
  if (!cfg.keywords || cfg.keywords.length === 0) {
    console.log("Background Search: No keywords configured. Skipping.");
    return;
  }

  console.log(`Background Search: Running search for keywords [${cfg.keywords.join(', ')}]...`);
  const data = getTokensData();
  const activeTwitter = data.tokens.find(t => t.id === data.activeTwitterTokenId);
  const twitterVal = activeTwitter ? activeTwitter.value : null;
  const twitterCt0 = activeTwitter ? activeTwitter.ct0 : null;

  const activeReddit = data.tokens.find(t => t.id === data.activeRedditTokenId);
  const redditVal = activeReddit ? activeReddit.value : null;

  try {
    const hoursNum = 24; // Check past 24 hours to ensure we don't miss anything during offline/sleep times
    const [redditResults, twitterResults] = await Promise.all([
      scrapeRedditCli(cfg.keywords, hoursNum, redditVal),
      scrapeTwitterCli(cfg.keywords, hoursNum, twitterVal, twitterCt0, cfg.excludes)
    ]);

    let allResults = [...twitterResults, ...redditResults];

    // Filter excludes
    if (cfg.excludes && cfg.excludes.length > 0) {
      allResults = allResults.filter(item => {
        const lowerText = item.text.toLowerCase();
        return !cfg.excludes.some(ex => lowerText.includes(ex));
      });
    }

    // Deduplicate by author (keep only the newest post per unique author handle in this run)
    const seenAuthorsBg = new Set();
    allResults = allResults.filter(item => {
      const handle = item.userProfile?.handle?.toLowerCase();
      if (!handle) return true;
      if (seenAuthorsBg.has(handle)) return false;
      seenAuthorsBg.add(handle);
      return true;
    });

    // Load existing discovered posts
    const discovered = getDiscoveredPosts();
    const existingIds = new Set(discovered.map(p => p.id));
    
    let newCount = 0;
    const newlyDiscoveredPosts = [];
    allResults.forEach(post => {
      if (!existingIds.has(post.id)) {
        const fullPost = {
          ...post,
          isRead: false,
          notified: false
        };
        discovered.push(fullPost);
        newlyDiscoveredPosts.push(fullPost);
        newCount++;
      }
    });

    if (newCount > 0) {
      // Sort discovered posts newest first
      discovered.sort((a, b) => new Date(b.time) - new Date(a.time));
      saveDiscoveredPosts(discovered);
      console.log(`Background Search: Found ${newCount} new matching posts!`);

      // Trigger Electron Native Notification
      let title, body;
      if (newCount === 1) {
        const post = newlyDiscoveredPosts[0];
        const platformName = post.platform === 'reddit' ? 'Reddit' : 'X (Twitter)';
        title = `New Lead on ${platformName}`;
        
        const name = post.userProfile.name || 'User';
        const handleStr = post.userProfile.handle ? ` (@${post.userProfile.handle})` : '';
        body = `${name}${handleStr}: ${post.text}`;
        if (body.length > 120) {
          body = body.substring(0, 117) + '...';
        }
      } else {
        title = `${newCount} New Leads Discovered!`;
        body = `Found ${newCount} new posts matching your active keywords. Click to view.`;
      }

      const firstNewPost = newlyDiscoveredPosts[0];
      if (process.send) {
        process.send({ 
          type: 'notification', 
          title, 
          body, 
          postId: newCount === 1 ? firstNewPost.id : null,
          platform: newCount === 1 ? firstNewPost.platform : null
        });
      } else if (global.triggerNotification) {
        global.triggerNotification(
          title, 
          body, 
          newCount === 1 ? firstNewPost.id : null,
          newCount === 1 ? firstNewPost.platform : null
        );
      }
    } else {
      console.log("Background Search: No new posts found.");
    }
  } catch (err) {
    console.error("Background Search Error:", err);
  }
};

const startBackgroundWorker = () => {
  if (bgIntervalId) {
    clearInterval(bgIntervalId);
  }
  const cfg = getConfig();
  const intervalMs = (cfg.intervalMinutes || 5) * 60 * 1000;
  
  // Run once immediately on start
  runBackgroundSearch();
  
  bgIntervalId = setInterval(runBackgroundSearch, intervalMs);
  console.log(`Background worker started. Running search every ${cfg.intervalMinutes || 5} minutes.`);
};

// Start background worker 5 seconds after server startup to allow initialization
setTimeout(startBackgroundWorker, 5000);

// --- Config API ---
app.get('/api/config', (req, res) => {
  res.json(getConfig());
});

app.post('/api/config', (req, res) => {
  const { keywords, excludes, intervalMinutes, commentDelay } = req.body;
  const cfg = getConfig();
  if (keywords) cfg.keywords = keywords;
  if (excludes) cfg.excludes = excludes;
  if (intervalMinutes) cfg.intervalMinutes = parseInt(intervalMinutes) || 5;
  if (commentDelay !== undefined) cfg.commentDelay = parseInt(commentDelay) || 0;
  saveConfig(cfg);
  startBackgroundWorker(); // Restart background worker with new configurations
  res.json(cfg);
});

// --- Profile API ---
app.get('/api/profiles', (req, res) => {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
  const dirs = fs.readdirSync(PROFILES_DIR).filter(file => {
    return fs.statSync(path.join(PROFILES_DIR, file)).isDirectory();
  });
  if (!dirs.includes('default')) {
    dirs.push('default');
  }
  res.json({
    activeProfile,
    profiles: dirs
  });
});

app.post('/api/profiles', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Profile name is required' });
  }
  const cleanName = name.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Invalid profile name' });
  }
  
  activeProfile = cleanName;
  saveActiveProfile(cleanName);
  const newProfileDir = path.join(PROFILES_DIR, cleanName);
  if (!fs.existsSync(newProfileDir)) {
    fs.mkdirSync(newProfileDir, { recursive: true });
  }
  
  startBackgroundWorker();
  
  const dirs = fs.readdirSync(PROFILES_DIR).filter(file => {
    return fs.statSync(path.join(PROFILES_DIR, file)).isDirectory();
  });
  if (!dirs.includes('default')) {
    dirs.push('default');
  }
  res.json({
    activeProfile,
    profiles: dirs
  });
});

app.put('/api/profiles/active', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Profile name is required' });
  
  const profileDir = path.join(PROFILES_DIR, name);
  if (name !== 'default' && !fs.existsSync(profileDir)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  
  activeProfile = name;
  saveActiveProfile(name);
  console.log(`Switched active profile to: ${activeProfile}`);
  
  startBackgroundWorker();
  
  res.json({ activeProfile });
});

// --- Data Export & Import APIs ---
app.get('/api/export-data', (req, res) => {
  const exportBundle = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    activeProfile,
    config: getConfig(),
    tokens: getTokensData(),
    templates: getTemplatesData(),
    discoveredPosts: getDiscoveredPosts()
  };
  res.json(exportBundle);
});

app.post('/api/import-data', (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    if (data.config) saveConfig(data.config);
    if (data.tokens) saveTokensData(data.tokens);
    if (data.templates) saveTemplatesData(data.templates);
    if (data.discoveredPosts) saveDiscoveredPosts(data.discoveredPosts);

    startBackgroundWorker();
    res.json({ success: true, message: 'Data imported successfully!' });
  } catch (err) {
    console.error('Import Error:', err);
    res.status(500).json({ error: 'Failed to import data: ' + err.message });
  }
});

// --- Inbox API (Discovered Posts) ---
app.get('/api/inbox-posts', async (req, res) => {
  const { refresh } = req.query;
  if (refresh === 'true') {
    console.log("Forced refresh: Running background search...");
    try {
      await runBackgroundSearch();
    } catch (err) {
      console.error("Failed to run search on refresh:", err);
    }
  }
  
  const posts = getDiscoveredPosts();
  const seenAuthors = new Set();
  const uniquePosts = posts.filter(item => {
    const handle = item.userProfile?.handle?.toLowerCase();
    if (!handle) return true;
    if (seenAuthors.has(handle)) return false;
    seenAuthors.add(handle);
    return true;
  });
  res.json({ posts: uniquePosts });
});

app.post('/api/inbox-posts/read', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Missing ids array" });
  const posts = getDiscoveredPosts();
  let changed = false;
  posts.forEach(p => {
    if (ids.includes(p.id)) {
      p.isRead = true;
      p.notified = true;
      changed = true;
    }
  });
  if (changed) {
    saveDiscoveredPosts(posts);
  }
  res.json({ success: true });
});

app.get('/api/notify-action', async (req, res) => {
  const { id, type } = req.query; // id: post.id, type: 'dm' | 'comment'
  if (!id || !type) {
    return res.status(400).send("<h3>Missing required parameters (id, type)</h3>");
  }

  console.log(`Notification action triggered for ID: ${id}, Type: ${type}`);

  const posts = getDiscoveredPosts();
  const post = posts.find(p => p.id === id);
  if (!post) {
    return res.status(404).send(`
      <html>
        <body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
          <h1 style="color:#ef4444;margin-bottom:10px;">❌ Post Not Found</h1>
          <p style="color:#94a3b8;font-size:1.1rem;">The lead with ID "${id}" was not found.</p>
        </body>
      </html>
    `);
  }

  const templatesData = getTemplatesData();
  if (templatesData.templates.length === 0) {
    return res.status(400).send(`
      <html>
        <body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
          <h1 style="color:#f59e0b;margin-bottom:10px;">⚠️ Setup Needed</h1>
          <p style="color:#94a3b8;font-size:1.1rem;text-align:center;max-width:400px;">Please open the app settings and add at least one DM template first.</p>
        </body>
      </html>
    `);
  }

  const tokens = getTokensData();
  const activeTwitter = tokens.tokens.find(t => t.id === tokens.activeTwitterTokenId);
  const activeReddit = tokens.tokens.find(t => t.id === tokens.activeRedditTokenId);

  // Mark lead as read
  let changed = false;
  posts.forEach(p => {
    if (p.id === id) {
      p.isRead = true;
      changed = true;
    }
  });
  if (changed) saveDiscoveredPosts(posts);

  const postTextLower = (post.text || '').toLowerCase();
  const matchingTemplates = templatesData.templates.filter(t => 
    t.keyword && postTextLower.includes(t.keyword.trim().toLowerCase())
  );
  
  let templateObj;
  if (matchingTemplates.length > 0) {
    templateObj = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)];
    console.log(`Keyword Template Match (Notify Action): Found matching template for post ${post.id} (Keyword: "${templateObj.keyword}")`);
  } else {
    const fallbacks = templatesData.templates.filter(t => !t.keyword);
    const pool = fallbacks.length > 0 ? fallbacks : templatesData.templates;
    templateObj = pool[Math.floor(Math.random() * pool.length)];
  }
  
  let message = templateObj.text
    .replace(/{username}/g, post.userProfile?.name || '')
    .replace(/{handle}/g, post.userProfile?.handle || '');

  try {
    if (post.platform === 'reddit') {
      if (!activeReddit || !activeReddit.value) {
        throw new Error('No active Reddit session token found.');
      }
      const username = post.userProfile.name;
      const postName = post.id.replace('reddit_', '');
      
      const args = ['comment', postName, message];
      const envs = { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
      const { stdout, stderr, error } = await runCli(REDDIT_PATH, args, envs);
      if (error) throw new Error(stderr || error.message);
      
    } else if (post.platform === 'twitter') {
      if (!activeTwitter || !activeTwitter.value) {
        throw new Error('No active Twitter auth token found.');
      }
      const screenName = (post.userProfile?.handle || '').replace('@', '');
      const bareTweetId = post.id.replace('twitter_', '');
      
      const doDM = (type === 'dm');
      const doComment = (type === 'comment');
      
      const pyCode = `
import sys, json
from twitter_cli.client import TwitterClient
client = TwitterClient(auth_token="${activeTwitter.value}", ct0="${activeTwitter.ct0 || ''}")
results = {}
if ${doDM ? 'True' : 'False'}:
    try:
        user = client.fetch_user("${screenName}")
        url = "https://x.com/i/api/1.1/direct_messages/events/new.json"
        payload = {
            "event": {
                "type": "message_create",
                "message_create": {
                    "target": {"recipient_id": user.id},
                    "message_data": {"text": ${JSON.stringify(message)}}
                }
            }
        }
        client._api_request(url, method="POST", body=payload)
        results["dm"] = "sent"
    except Exception as e:
        results["dm_error"] = str(e)

if ${doComment ? 'True' : 'False'}:
    try:
        client.create_tweet(${JSON.stringify(message)}, reply_to_id="${bareTweetId}")
        results["comment"] = "sent"
    except Exception as e:
        results["comment_error"] = str(e)

print(json.dumps(results))
`;
      const args = ['-c', pyCode];
      const pythonPath = PYTHON_PATH;
      const envs = { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
      
      const { stdout, stderr, error } = await runCli(pythonPath, args, envs);
      if (error) throw new Error(stderr || error.message);
      
      const resp = JSON.parse(stdout);
      if (doDM && resp.dm_error) throw new Error("DM Error: " + resp.dm_error);
      if (doComment && resp.comment_error) throw new Error("Comment Error: " + resp.comment_error);
    }

    res.send(`
      <html>
        <body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
          <h1 style="color:#10b981;margin-bottom:10px;">⚡ Action Executed!</h1>
          <p style="color:#94a3b8;font-size:1.1rem;text-align:center;max-width:400px;line-height:1.5;">Successfully executed your automated action to <strong>${post.userProfile?.name}</strong>!</p>
          <script>setTimeout(() => window.close(), 3500);</script>
        </body>
      </html>
    `);

  } catch (err) {
    console.error("Failed notification action:", err.message);
    res.status(500).send(`
      <html>
        <body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;padding:20px;text-align:center;">
          <h1 style="color:#ef4444;margin-bottom:10px;">❌ Action Failed</h1>
          <p style="color:#f87171;font-size:1.1rem;max-width:500px;line-height:1.5;background:rgba(239,68,68,0.1);padding:15px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);">${err.message}</p>
        </body>
      </html>
    `);
  }
});

// --- Search Endpoint ---

app.get('/api/search', async (req, res) => {
  const { keyword, excludes, hours } = req.query;
  const hoursNum = parseFloat(hours) || 24;
  console.log(`Received search request for keyword: ${keyword}, excludes: ${excludes}, hours: ${hoursNum}`);
  
  if (!keyword) {
    return res.json([]);
  }

  const { keywords, redditQuery, twitterQuery } = parseKeywords(keyword);
  const excludeKeywords = excludes ? excludes.split(',').map(e => e.trim().toLowerCase()).filter(e => e) : [];

  const data = getTokensData();
  
  // Find active Twitter token
  const activeTwitter = data.tokens.find(t => t.id === data.activeTwitterTokenId);
  const twitterVal = activeTwitter ? activeTwitter.value : null;
  const twitterCt0 = activeTwitter ? activeTwitter.ct0 : null;

  // Find active Reddit token
  const activeReddit = data.tokens.find(t => t.id === data.activeRedditTokenId);
  const redditVal = activeReddit ? activeReddit.value : null;

  // Run scrapers concurrently
  const [redditResults, twitterResults] = await Promise.all([
    scrapeRedditCli(keywords, hoursNum, redditVal),
    scrapeTwitterCli(keywords, hoursNum, twitterVal, twitterCt0, excludeKeywords)
  ]);

  let allResults = [...twitterResults, ...redditResults];

  // Apply exclude keywords filter if specified
  if (excludeKeywords.length > 0) {
    allResults = allResults.filter(item => {
      const lowerText = item.text.toLowerCase();
      return !excludeKeywords.some(ex => lowerText.includes(ex));
    });
  }

  allResults.sort((a, b) => {
    return new Date(b.time) - new Date(a.time);
  });

  const seenAuthors = new Set();
  const uniqueResults = allResults.filter(item => {
    const handle = item.userProfile?.handle?.toLowerCase();
    if (!handle) return true;
    if (seenAuthors.has(handle)) return false;
    seenAuthors.add(handle);
    return true;
  });
  
  console.log(`Search complete. Returning ${uniqueResults.length} unique results.`);
  res.json(uniqueResults);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

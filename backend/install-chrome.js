const { install } = require('@puppeteer/browsers');
const puppeteer = require('puppeteer');
const path = require('path');

async function download() {
  const browser = puppeteer.SupportedBrowser.CHROME;
  const buildId = '123.0.6312.122'; // or any recent version
  const cacheDir = path.join(__dirname, '.cache', 'puppeteer');
  console.log('Downloading Chrome to', cacheDir);
  await install({
    browser,
    buildId,
    cacheDir
  });
  console.log('Done');
}

download().catch(console.error);

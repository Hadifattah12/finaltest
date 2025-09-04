const axios = require('axios');

let cachedUrl = null;

const getNgrokUrl = async () => {
  if (cachedUrl) {
    console.log('Using cached ngrok URL:', cachedUrl);
    return cachedUrl;
  }

  try {
    console.log('Attempting to fetch ngrok URL from localhost:4040...');
    const response = await axios.get('http://localhost:4040/api/tunnels');
    console.log('Ngrok API response received, tunnels found:', response.data.tunnels?.length || 0);
    
    const httpsTunnel = response.data.tunnels.find(t => t.proto === 'https');
    if (!httpsTunnel) {
      console.log('Available tunnels:', response.data.tunnels);
      throw new Error('No HTTPS ngrok tunnel found in tunnels list');
    }
    
    cachedUrl = httpsTunnel.public_url;
    console.log('✅ Got ngrok URL from API:', cachedUrl);
    return cachedUrl;
  } catch (err) {
    console.error('❌ Failed to get ngrok URL:', err.message);
    // Don't use fallback, let the error bubble up so we can see what's wrong
    throw err;
  }
};

module.exports = getNgrokUrl;

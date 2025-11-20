# Bot Embedding Feature

## Overview

The bot embedding feature allows users to easily integrate their PlugRAG chatbots into any website with a simple copy-paste code snippet. This feature provides a complete solution for deploying AI-powered customer support across multiple websites.

## Features

### ✅ Implemented Features

1. **Widget Script (`/embed.js`)**
   - Responsive chat widget that works on any website
   - Customizable colors, positioning, and messaging
   - Mobile-friendly design with smooth animations
   - Session management and message history

2. **Domain Security**
   - Domain whitelist validation
   - CORS headers for secure cross-origin requests
   - Request origin validation and logging

3. **Embed Code Generator**
   - Real-time preview of chat widget
   - Live customization options
   - Copy-to-clipboard functionality
   - Dynamic configuration generation

4. **Security & Validation**
   - Domain whitelist management in bot settings
   - Input validation and sanitization
   - Error handling and graceful fallbacks

## How It Works

### 1. Widget Architecture

```javascript
// The embed.js script creates a self-contained widget
(function() {
  // Reads configuration from window.PlugRAGConfig
  // Creates isolated chat interface
  // Communicates with your PlugRAG API
  // Handles session management
})();
```

### 2. API Integration

The widget communicates with these endpoints:
- `POST /api/chat/[botId]` - Send messages and receive AI responses
- `GET /api/chat/[botId]` - Retrieve conversation history
- `DELETE /api/chat/[botId]` - Clear conversation (optional)

### 3. Security Model

- **Domain Whitelist**: Control which websites can embed your bot
- **CORS Headers**: Secure cross-origin communication
- **Public API**: Chat endpoints don't require authentication
- **Session Isolation**: Each page load creates a new session

## Usage Guide

### Step 1: Configure Your Bot

1. Go to your bot's dashboard
2. Navigate to the "Embed" tab
3. Customize appearance (color, position, messages)
4. Add allowed domains to the whitelist (optional)

### Step 2: Copy Embed Code

The generated embed code looks like this:

```html
<!-- PlugRAG Embed Code -->
<script>
  window.PlugRAGConfig = {
    botId: "your-bot-id",
    color: "#f97316",
    position: "bottom-right", 
    greeting: "Hi! How can I help you today?",
    placeholder: "Type your message...",
    apiBase: "https://yourdomain.com"
  };
</script>
<script src="https://yourdomain.com/embed.js" async></script>
```

### Step 3: Add to Your Website

1. Copy the generated code
2. Paste it before the closing `</body>` tag
3. The chatbot will automatically appear

## Configuration Options

### Required Parameters

- `botId`: Your bot's unique identifier
- `apiBase`: Your PlugRAG server URL

### Optional Parameters

- `color`: Theme color (hex format, default: #f97316)
- `position`: Widget position (bottom-right, bottom-left, top-right, top-left)
- `greeting`: Initial message from the bot
- `placeholder`: Input field placeholder text

### Example Configuration

```javascript
window.PlugRAGConfig = {
  botId: "670f8c4d8f123456789abcde",
  color: "#2563eb",
  position: "bottom-left",
  greeting: "Hello! I'm here to help with your questions.",
  placeholder: "Ask me anything...",
  apiBase: "https://api.plugrag.com"
};
```

## Domain Security

### Setting up Domain Whitelist

1. In the embed page, go to "Domain Security" section
2. Add domains where you want to allow embedding:
   - `example.com` - exact domain match
   - `blog.example.com` - subdomain match
   - Leave empty to allow all domains (not recommended for production)

### Security Benefits

- **Prevent unauthorized usage**: Stop others from using your bot
- **Control costs**: Limit API usage to your websites
- **Analytics accuracy**: Track usage by legitimate domains only

## Testing the Integration

### Local Development

1. Start your PlugRAG server: `npm run dev`
2. Open `/embed-test.html` in your browser
3. Replace `botId` with a real bot ID from your dashboard
4. Test the chat functionality

### Production Deployment

1. Update `apiBase` in embed code to your production URL
2. Ensure your server serves `embed.js` with proper headers
3. Add your production domain to the bot's whitelist
4. Test from your live website

## Troubleshooting

### Common Issues

1. **Widget not appearing**
   - Check browser console for JavaScript errors
   - Verify `botId` is correct
   - Ensure `embed.js` is loading properly

2. **"Unauthorized domain" error**
   - Add your domain to the bot's whitelist
   - Check that domain format is correct (no protocol, just domain)

3. **Chat not responding**
   - Verify bot is active and has processed files
   - Check API key configuration in bot settings
   - Look at server logs for error details

4. **CORS errors**
   - Ensure your server is sending proper CORS headers
   - Check that requests are going to the correct API base URL

### Debug Mode

Enable debug logging in embed.js by adding:

```javascript
window.PlugRAGConfig = {
  // ... your config
  debug: true
};
```

## File Structure

```
/public/
  embed.js              # Main widget script
  embed-test.html       # Test page for development

/src/app/api/chat/[botId]/
  route.js              # Chat API with CORS and domain validation

/src/app/dashboard/bots/[id]/embed/
  page.js               # Embed code generator interface

/src/models/
  Bot.js                # Bot model with domainWhitelist field
```

## Next Steps

### Potential Enhancements

1. **Advanced Customization**
   - Custom CSS injection
   - Multiple widget sizes
   - Theme presets

2. **Analytics Enhancement**
   - Real-time chat metrics
   - Domain-specific analytics
   - Performance monitoring

3. **Enterprise Features**
   - Signed embed tokens
   - Advanced rate limiting
   - Custom deployment options

### Production Considerations

1. **CDN Setup**: Serve `embed.js` from a CDN for better performance
2. **Version Management**: Implement versioning for widget updates
3. **Monitoring**: Add uptime monitoring for embed endpoints
4. **Backup**: Implement fallback mechanisms for high availability

## API Reference

### Domain Validation

The chat API validates requests against the bot's domain whitelist:

```javascript
// In /api/chat/[botId]/route.js
function validateDomain(bot, requestDomain) {
  if (!bot.domainWhitelist || bot.domainWhitelist.length === 0) {
    return true; // No whitelist = allow all
  }
  
  const cleanDomain = requestDomain.replace(/^https?:\/\//, '').split('/')[0];
  return bot.domainWhitelist.some(allowedDomain => {
    return cleanDomain === allowedDomain || cleanDomain.endsWith('.' + allowedDomain);
  });
}
```

### CORS Configuration

All chat endpoints include CORS headers:

```javascript
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}
```

This implementation provides a solid foundation for bot embedding while maintaining security and ease of use.
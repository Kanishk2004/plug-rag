# 🚀 Getting Started with PlugRAG

**Create your first AI-powered chatbot in under 10 minutes!**

This guide will walk you through setting up PlugRAG, creating your first bot, uploading documents, and embedding the chat widget on your website.

## 📖 Table of Contents

- [What You'll Build](#what-youll-build)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Your First Bot](#your-first-bot)
- [Upload Documents](#upload-documents)
- [Test Your Chatbot](#test-your-chatbot)
- [Embed on Website](#embed-on-website)
- [Next Steps](#next-steps)

---

## 🎯 What You'll Build

By the end of this guide, you'll have:

- ✅ A fully functional RAG-powered chatbot
- ✅ Document knowledge base with semantic search
- ✅ Embeddable chat widget for your website
- ✅ Analytics dashboard to monitor usage
- ✅ Understanding of core concepts

---

## 🔧 Prerequisites

### System Requirements

- **Node.js** 20.11 or higher ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** for version control
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Required Accounts (Free Tiers Available)

| Service | Purpose | Sign Up Link |
|---------|---------|--------------|
| **MongoDB Atlas** | Database | [Sign Up](https://www.mongodb.com/cloud/atlas) |
| **OpenAI** | AI/ML | [Get API Key](https://platform.openai.com/api-keys) |
| **Clerk** | Authentication | [Create Account](https://clerk.com/) |
| **AWS** | File Storage (S3) | [Sign Up](https://aws.amazon.com/) |

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier - Code formatter
  - Tailwind CSS IntelliSense
  - ES6+ snippets

---

## ⚙️ Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/plugrag.git
cd plugrag
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including Next.js, React, MongoDB drivers, and AI libraries.

### Step 3: Set Up MongoDB Atlas

1. **Create a free cluster:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Click "Build a Database"
   - Choose "M0" (Free tier)
   - Select your region
   - Click "Create"

2. **Create database user:**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Username: `plugrag-user`
   - Password: (generate strong password)
   - Role: "Atlas Admin" or "Read/Write to any database"
   - Click "Add User"

3. **Allow network access:**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Click "Confirm"

4. **Get connection string:**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password

### Step 4: Set Up Clerk Authentication

1. **Create application:**
   - Go to [Clerk](https://clerk.com/)
   - Click "Add Application"
   - Name: "PlugRAG"
   - Enable "Email" and "Google" (optional)

2. **Get API keys:**
   - Go to "API Keys"
   - Copy "Publishable key" (starts with `pk_`)
   - Copy "Secret key" (starts with `sk_`)

3. **Configure webhooks:**
   - Go to "Webhooks"
   - Click "Add Endpoint"
   - URL: `http://localhost:3000/api/webhooks/clerk` (for now)
   - Events: Select `user.created`, `user.updated`, `user.deleted`
   - Copy "Signing Secret" (starts with `whsec_`)

### Step 5: Set Up OpenAI

1. **Get API key:**
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Name: "PlugRAG"
   - Copy the key (starts with `sk-`)
   - **⚠️ Save it now - you won't see it again!**

2. **Add credits (if needed):**
   - Go to "Billing"
   - Add payment method
   - Set usage limits

### Step 6: Set Up AWS S3

1. **Create IAM user:**
   - Go to AWS Console → IAM
   - Click "Users" → "Add user"
   - User name: `plugrag-s3`
   - Enable "Access key - Programmatic access"
   - Attach policy: "AmazonS3FullAccess"
   - Save Access Key ID and Secret Access Key

2. **Create S3 bucket:**
   - Go to S3 console
   - Click "Create bucket"
   - Bucket name: `plugrag-files-yourname` (must be unique)
   - Region: Choose closest to you
   - Uncheck "Block all public access" (we'll use presigned URLs)
   - Click "Create bucket"

3. **Configure CORS:**
   - Select your bucket → Permissions → CORS
   - Add:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

### Step 7: Configure Environment Variables

1. **Create environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`:**
   ```env
   # MongoDB
   MONGODB_URI=mongodb+srv://plugrag-user:YOUR_PASSWORD@cluster.mongodb.net/plugrag?retryWrites=true&w=majority
   
   # Clerk Authentication
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_WEBHOOK_SECRET=whsec_...
   
   # Encryption (MUST be exactly 32 characters)
   ENCRYPTION_SECRET_KEY=abcdefghijklmnopqrstuvwxyz123456
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # AWS S3
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=plugrag-files-yourname
   
   # Redis (Docker - don't change)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Qdrant (Docker - don't change)
   QDRANT_URL=http://localhost:6333
   
   # Application
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   **⚠️ Important:**
   - `ENCRYPTION_SECRET_KEY` must be exactly 32 characters
   - Never commit `.env.local` to git
   - Keep your keys secure

### Step 8: Start Local Services

Start Redis and Qdrant using Docker:

```bash
docker-compose up redis qdrant -d
```

Verify they're running:
```bash
docker-compose ps
```

You should see:
```
NAME      STATUS    PORTS
redis     running   0.0.0.0:6379->6379/tcp
qdrant    running   0.0.0.0:6333->6333/tcp
```

### Step 9: Start the Application

**Terminal 1 - Main Application:**
```bash
npm run dev
```

**Terminal 2 - Worker Process:**
```bash
npm run worker
```

### Step 10: Verify Installation

1. **Check application:**
   - Open http://localhost:3000
   - You should see the landing page

2. **Sign up:**
   - Click "Sign Up"
   - Create an account
   - You should be redirected to the dashboard

3. **Check health:**
   - Visit http://localhost:3000/api/health
   - You should see: `{"status":"ok"}`

---

## 🤖 Your First Bot

### Step 1: Create Bot

1. **Go to dashboard:**
   - Navigate to http://localhost:3000/dashboard
   - Click "Create Bot" or "New Bot"

2. **Fill in details:**
   ```
   Bot Name: Customer Support Bot
   Description: Answers customer questions about our products
   System Prompt: You are a helpful customer support assistant. 
                  Always be polite and professional.
   Welcome Message: Hi! How can I help you today?
   ```

3. **Configure OpenAI (optional):**
   - Scroll to "OpenAI Configuration"
   - To use your own key: Enter OpenAI API key
   - To use fallback: Leave empty and check "Enable Fallback"
   - Model: `gpt-4` (or `gpt-4-turbo` for faster responses)
   - Temperature: `0.7` (0.0 = deterministic, 1.0 = creative)
   - Max Tokens: `500`

4. **Add FAQs (optional):**
   ```
   Question: What are your hours?
   Answer: We're open Monday-Friday, 9 AM to 5 PM EST.
   
   Question: How do I contact support?
   Answer: Email us at support@example.com or call 1-800-SUPPORT.
   ```

5. **Click "Create Bot"**

### Step 2: Verify Bot Creation

You should see:
- Success message
- Redirect to bot detail page
- Bot status: "Active"
- Qdrant collection created

---

## 📄 Upload Documents

### Step 1: Prepare Documents

Supported formats:
- PDF (`.pdf`) - Product manuals, guides
- Word (`.docx`) - Policies, procedures
- Text (`.txt`, `.md`) - Documentation
- CSV (`.csv`) - FAQs, data
- HTML (`.html`) - Web content

**Tips:**
- Keep files under 50 MB
- Use clear, well-formatted documents
- Remove sensitive information
- Include relevant context

### Step 2: Upload Files

1. **Navigate to Files tab:**
   - Go to your bot detail page
   - Click "Files" tab
   - Click "Upload Files"

2. **Select files:**
   - Drag and drop or click to browse
   - Select one or multiple files
   - Supported types will be shown

3. **Upload:**
   - Click "Upload"
   - Files will upload to S3
   - Processing will start automatically

### Step 3: Monitor Processing

You'll see processing status for each file:

```
Processing → Extracting Text → Chunking → Generating Embeddings → Completed
```

**Processing times:**
- Small files (< 1 MB): 10-30 seconds
- Medium files (1-10 MB): 30-60 seconds
- Large files (10-50 MB): 1-3 minutes

**Check worker logs:**
```bash
# In worker terminal, you'll see:
✅ Environment variables loaded
🚀 Worker started successfully
📄 Processing file: product-manual.pdf
✨ Extracted 5000 characters
📦 Created 12 chunks
🧠 Generated embeddings
✅ File processing completed
```

### Step 4: Verify Upload

In the Files tab, you should see:
- ✅ Status: "Completed"
- 📊 Chunk count
- 📄 Page count (for PDFs)
- 🕐 Upload timestamp

---

## 💬 Test Your Chatbot

### Method 1: Test Widget

1. **Go to bot detail page**
2. **Click "Test Chat" tab**
3. **Try some questions:**
   ```
   You: Hello!
   Bot: Hi! How can I help you today?
   
   You: What information do you have?
   Bot: [Responses based on uploaded documents]
   
   You: What are your hours?
   Bot: We're open Monday-Friday, 9 AM to 5 PM EST.
   ```

### Method 2: Test Embed Page

1. **Open:** http://localhost:3000/embed-test.html
2. **Replace `BOT_ID`** in the script with your bot ID
3. **Test the chat widget**

### Method 3: API Testing

```bash
curl -X POST http://localhost:3000/api/chat/YOUR_BOT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "sessionId": "test-session-123",
    "domain": "localhost",
    "userFingerprint": "test-fp-123"
  }'
```

---

## 🌐 Embed on Website

### Step 1: Get Embed Code

1. **Go to bot detail page**
2. **Click "Embed" tab**
3. **Copy the embed code:**

```html
<!-- Add before closing </body> tag -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PlugRAG']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'plugrag', 'http://localhost:3000/embed.js'));
  
  plugrag('init', {
    botId: 'YOUR_BOT_ID',
    primaryColor: '#FF6B35'
  });
</script>
```

### Step 2: Customize Widget

```javascript
plugrag('init', {
  botId: 'YOUR_BOT_ID',
  primaryColor: '#FF6B35',      // Main theme color
  position: 'bottom-right',     // Widget position
  offset: { x: 20, y: 20 },    // Distance from edges
  welcomeMessage: 'Custom welcome!',
  placeholder: 'Type your message...',
  title: 'Chat with us',
  subtitle: 'We typically reply instantly'
});
```

### Step 3: Test on Your Website

1. **Create test HTML file:**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Test Page</title>
   </head>
   <body>
     <h1>My Website</h1>
     <p>The chat widget should appear in the bottom-right corner.</p>
     
     <!-- Paste embed code here -->
     
   </body>
   </html>
   ```

2. **Open in browser**
3. **Verify:**
   - Widget appears
   - Opens when clicked
   - Messages send and receive
   - Styling matches your theme

### Step 4: Domain Whitelist (Optional)

For production, whitelist your domains:

1. Go to bot settings
2. Add to "Domain Whitelist":
   ```
   example.com
   *.example.com
   app.example.com
   ```
3. Widget will only work on these domains

---

## 📊 Monitor Analytics

### View Dashboard

1. **Go to bot detail page**
2. **Check Analytics tab:**
   - Total messages
   - Total conversations
   - Average messages per conversation
   - Last message time

### View Conversations

1. **Click "Conversations" tab**
2. **See all chat sessions:**
   - Session ID
   - Message count
   - Domain
   - Timestamp
3. **Click a conversation to view full history**

---

## 🎓 Next Steps

### Improve Your Bot

- ✅ **Add more documents** - Upload additional knowledge base files
- ✅ **Fine-tune prompts** - Adjust system prompt for better responses
- ✅ **Add FAQs** - Quick answers for common questions
- ✅ **Customize widget** - Match your brand colors and style
- ✅ **Monitor usage** - Check analytics regularly

### Advanced Features

- 📖 **Read [API Reference](API-REFERENCE.md)** - Integrate via REST API
- 🏗️ **Read [Architecture](ARCHITECTURE.md)** - Understand the system
- 🚀 **Read [Deployment Guide](DEPLOYMENT.md)** - Deploy to production
- 🤝 **Read [Contributing](../CONTRIBUTING.md)** - Contribute to the project

### Production Checklist

Before going live:
- [ ] Use production database (MongoDB Atlas M10+)
- [ ] Use production Redis (Upstash, Redis Cloud)
- [ ] Use production Qdrant (Qdrant Cloud or self-hosted)
- [ ] Set up domain whitelist
- [ ] Enable rate limiting
- [ ] Configure monitoring
- [ ] Set up backups
- [ ] Use HTTPS
- [ ] Test thoroughly
- [ ] Review security checklist

---

## ❓ Troubleshooting

### Application Won't Start

**Error:** `Cannot connect to MongoDB`
```bash
# Check connection string
# Verify IP whitelist in MongoDB Atlas
# Test connection with MongoDB Compass
```

**Error:** `Cannot connect to Redis`
```bash
# Verify Docker is running
docker-compose ps

# Restart Redis
docker-compose restart redis
```

**Error:** `Cannot connect to Qdrant`
```bash
# Verify Docker container
docker-compose ps

# Check logs
docker-compose logs qdrant
```

### File Upload Failures

**Issue:** Upload hangs or fails

1. Check S3 credentials in `.env.local`
2. Verify bucket exists and permissions are correct
3. Check CORS configuration
4. Look at worker logs for errors

### Bot Not Responding

**Issue:** No response or error in chat

1. Check OpenAI API key is valid
2. Verify bot has uploaded files
3. Check worker is running
4. Look at browser console for errors
5. Check API logs

### Worker Not Processing

**Issue:** Files stuck in "processing"

1. Verify worker is running: `npm run worker`
2. Check Redis connection
3. Look at worker terminal for errors
4. Check file format is supported

---

## 🆘 Getting Help

### Resources

- **Documentation:** [docs/](.)
- **API Reference:** [API-REFERENCE.md](API-REFERENCE.md)
- **GitHub Issues:** Report bugs and request features
- **GitHub Discussions:** Ask questions and share ideas

### Common Questions

**Q: Can I use my own OpenAI key?**  
A: Yes! Add it in bot configuration. This gives you direct control over costs.

**Q: Is there a file size limit?**  
A: Yes, 50 MB per file. For larger files, split them into smaller documents.

**Q: How much does it cost?**  
A: PlugRAG is free. You pay only for:
- MongoDB Atlas (free tier available)
- OpenAI API usage (~$0.01-0.05 per conversation)
- AWS S3 storage (~$0.023 per GB/month)
- Redis/Qdrant (free tiers available)

**Q: Can I self-host everything?**  
A: Yes! Use Docker deployment for full control. See [DOCKER.md](../DOCKER.md).

**Q: How do I upgrade to production?**  
A: See [Deployment Guide](DEPLOYMENT.md) for Vercel, AWS, or Docker deployment.

---

## 🎉 Congratulations!

You've successfully set up PlugRAG and created your first AI-powered chatbot! 

**What you've accomplished:**
- ✅ Installed and configured PlugRAG
- ✅ Created a chatbot with document knowledge
- ✅ Uploaded and processed documents
- ✅ Embedded chat widget on a website
- ✅ Monitored analytics

**Next:** Start building amazing chatbot experiences! 🚀

---

**Need help?** Open an issue on GitHub or check our documentation.

**Want to contribute?** See [CONTRIBUTING.md](../CONTRIBUTING.md).

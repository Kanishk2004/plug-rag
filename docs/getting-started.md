# 🚀 Getting Started with PlugRAG

> **Create your first AI-powered chatbot in under 5 minutes**

## 📋 **Table of Contents**
- [What You'll Build](#what-youll-build)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Your First Bot](#your-first-bot)
- [Upload Documents](#upload-documents)
- [Test Your Chatbot](#test-your-chatbot)
- [Embed on Website](#embed-on-website)
- [Next Steps](#next-steps)

---

## 🎯 **What You'll Build**

By the end of this guide, you'll have:
- ✅ A fully functional RAG-powered chatbot
- ✅ Document knowledge base with semantic search
- ✅ Embeddable chat widget for your website
- ✅ Analytics dashboard to monitor performance
- ✅ Understanding of the core concepts

---

## 🔧 **Prerequisites**

### **System Requirements**
- **Node.js** 20.11+ ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** for version control

### **Required Accounts** (Free Tiers Available)
- **MongoDB Atlas** - [Sign Up](https://www.mongodb.com/cloud/atlas)
- **OpenAI API** - [Get API Key](https://platform.openai.com/api-keys)
- **Clerk Authentication** - [Create Account](https://clerk.com/)

### **Recommended Tools**
- **VS Code** with extensions:
  - ES6+ snippets
  - Prettier - Code formatter
  - ESLint
  - Tailwind CSS IntelliSense

---

## ⚙️ **Installation**

### **Step 1: Clone Repository**
```bash
# Clone the repository
git clone https://github.com/Kanishk2004/chat-bot.git
cd chat-bot

# Install dependencies
npm install
```

### **Step 2: Start Vector Database**
```bash
# Start Qdrant using Docker Compose
docker-compose up -d

# Verify Qdrant is running
curl http://localhost:6333/health
```

Expected response:
```json
{"title":"qdrant - vector search engine","version":"1.8.1"}
```

---

## 🔐 **Configuration**

### **Step 1: Create Environment File**
Create `.env.local` in your project root:

```bash
# Copy the example environment file
cp .env.example .env.local
```

### **Step 2: Configure Authentication (Clerk)**

1. **Create Clerk Application**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Click "Create Application"
   - Choose "Next.js" as framework
   - Select authentication methods (Email, Google, GitHub)

2. **Get Clerk Keys**:
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

3. **Configure Webhooks**:
   - In Clerk Dashboard, go to "Webhooks"
   - Add endpoint: `http://localhost:3000/api/webhooks/clerk`
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Copy webhook secret:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

### **Step 3: Configure Database (MongoDB)**

1. **Create MongoDB Cluster**:
   - Go to [MongoDB Atlas](https://cloud.mongodb.com/)
   - Create free cluster (M0 Sandbox)
   - Create database user and password
   - Whitelist IP address (0.0.0.0/0 for development)

2. **Get Connection String**:
   ```bash
   # Add to .env.local
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/plugrag?retryWrites=true&w=majority
   ```

### **Step 4: Configure AI Services (OpenAI)**

1. **Get OpenAI API Key**:
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create new API key
   - Add billing information (required for API access)

2. **Add to Environment**:
   ```bash
   # Add to .env.local
   OPENAI_API_KEY=sk-proj-...
   ```

### **Step 5: Configure Vector Database**
```bash
# Add to .env.local
QDRANT_URL=http://localhost:6333

# Application URL (for webhooks and callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### **Complete .env.local File**
```bash
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/plugrag

# Vector Database
QDRANT_URL=http://localhost:6333

# AI Services
OPENAI_API_KEY=sk-proj-...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🚀 **Start Development Server**

```bash
# Start the Next.js development server
npm run dev
```

**Verify Installation**:
- Open [http://localhost:3000](http://localhost:3000)
- You should see the PlugRAG landing page
- Click "Sign In" to test authentication

**Run Health Checks**:
```bash
# Test vector integration
npm run test:vectors

# Check API endpoints
curl http://localhost:3000/api/vectors/health
```

---

## 🤖 **Your First Bot**

### **Step 1: Sign Up & Login**
1. Go to [http://localhost:3000](http://localhost:3000)
2. Click "Get Started" or "Sign In"
3. Create account with email or social login
4. Complete profile setup

### **Step 2: Access Dashboard**
After login, you'll be redirected to the dashboard at `/dashboard` where you can see:
- Bot statistics overview
- Recent bots (empty for new accounts)
- Quick action buttons

### **Step 3: Create Your First Bot**

1. **Click "Create New Bot"** or navigate to `/dashboard/create-bot`

2. **Fill Bot Details**:
   ```
   Bot Name: Customer Support Assistant
   Description: Helps customers with product questions and support issues
   ```

3. **Customize Appearance**:
   - **Primary Color**: Choose your brand color (e.g., `#3B82F6`)
   - **Position**: `bottom-right` (recommended)
   - **Greeting**: "Hi! How can I help you today?"
   - **Placeholder**: "Type your question..."
   - **Title**: "Support Chat"

4. **Click "Create Bot"**

**Expected Result**:
- Bot created with unique ID (e.g., `bot_abc123`)
- Vector storage automatically initialized
- Redirect to bot management page

---

## 📄 **Upload Documents**

### **Step 1: Prepare Training Materials**

Create sample documents to train your bot:

**Sample FAQ Document (save as `faq.txt`)**:
```
# Frequently Asked Questions

## Account Management

### How do I reset my password?
To reset your password:
1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for reset link
5. Follow the instructions in the email

### How do I change my email address?
To change your email:
1. Log in to your account
2. Go to Account Settings
3. Click "Change Email"
4. Enter new email and confirm
5. Verify the new email address

## Billing

### How do I update my payment method?
To update payment information:
1. Go to Billing section
2. Click "Payment Methods"
3. Add new card or edit existing
4. Set as default if needed

### When will I be charged?
Billing occurs:
- Monthly on the same date you subscribed
- Immediately for plan upgrades
- Pro-rated for plan downgrades
```

### **Step 2: Upload Documents**

1. **Navigate to Bot Page**: `/dashboard/bots/{botId}`

2. **Use File Upload Section**:
   - Drag and drop files or click "Choose Files"
   - Select your prepared documents
   - Supported formats: PDF, DOCX, TXT, CSV, HTML

3. **Configure Processing Options**:
   ```json
   {
     "generateEmbeddings": true,
     "chunkSize": 700,
     "overlap": 100
   }
   ```

4. **Monitor Processing**:
   - Watch real-time processing status
   - Processing typically takes 1-3 minutes per file
   - Green checkmark indicates completion

**Expected Result**:
- Files processed and chunked
- Vector embeddings generated
- Searchable knowledge base created

### **Step 3: Verify Upload Success**

Check the bot analytics to confirm:
- **Total Embeddings**: Should show number of text chunks
- **Files**: Should list uploaded documents
- **Processing Status**: All files should show "Completed"

---

## 💬 **Test Your Chatbot**

### **Step 1: Use Built-in Chat Interface**

1. **Navigate to Bot Page**: `/dashboard/bots/{botId}`
2. **Find "Test Chat" Section**
3. **Send Test Messages**:
   ```
   Test 1: "How do I reset my password?"
   Test 2: "Tell me about billing"
   Test 3: "How do I change my email?"
   ```

### **Step 2: Verify RAG Responses**

Good responses should:
- **Answer accurately** based on uploaded documents
- **Include source references** showing which documents were used
- **Be contextually relevant** to the question asked
- **Respond quickly** (typically 1-3 seconds)

**Example Expected Response**:
```
User: "How do I reset my password?"

Bot: "To reset your password:
1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for reset link
5. Follow the instructions in the email

This information comes from your FAQ document."

Sources: [faq.txt - Account Management section]
```

### **Step 3: Test Edge Cases**

```
Test 1: "What is your name?" (Should identify as your bot)
Test 2: "What's the weather?" (Should politely decline non-relevant questions)
Test 3: "Tell me about advanced features" (Should indicate if no relevant info found)
```

---

## 🌐 **Embed on Website**

### **Step 1: Get Embed Code**

1. **Go to Bot Page**: `/dashboard/bots/{botId}`
2. **Click "Get Embed Code"** or navigate to `/dashboard/bots/{botId}/embed`
3. **Copy the provided script**:

```html
<!-- PlugRAG Chat Widget -->
<div id="plugrag-chat"></div>
<script 
  src="http://localhost:3000/embed.js"
  data-bot-id="your-bot-id"
  data-position="bottom-right"
  data-primary-color="#3B82F6"
  data-api-base="http://localhost:3000">
</script>
```

### **Step 2: Create Test Website**

Create a simple test page (`test.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test PlugRAG Chatbot</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
        }
        .content {
            background: #f5f5f5;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <h1>Welcome to Our Help Center</h1>
    
    <div class="content">
        <h2>Need Help?</h2>
        <p>Our AI assistant can help you with:</p>
        <ul>
            <li>Account management questions</li>
            <li>Billing and payment issues</li>
            <li>Technical support</li>
            <li>General inquiries</li>
        </ul>
        <p>Click the chat icon in the bottom-right corner to get started!</p>
    </div>

    <!-- PlugRAG Chat Widget -->
    <div id="plugrag-chat"></div>
    <script 
      src="http://localhost:3000/embed.js"
      data-bot-id="YOUR_BOT_ID_HERE"
      data-position="bottom-right"
      data-primary-color="#3B82F6"
      data-api-base="http://localhost:3000">
    </script>
</body>
</html>
```

### **Step 3: Test Embedded Widget**

1. **Replace `YOUR_BOT_ID_HERE`** with your actual bot ID
2. **Open `test.html`** in your browser
3. **Look for chat bubble** in bottom-right corner
4. **Click and test** the chat functionality

**Expected Behavior**:
- Chat bubble appears with your custom color
- Clicking opens chat interface
- Messages work identically to dashboard test
- Conversations persist during session

---

## 📊 **Monitor Analytics**

### **Step 1: Check Real-time Stats**

Navigate to your bot dashboard and monitor:

- **Total Messages**: Number of chat interactions
- **Total Sessions**: Unique conversation sessions
- **Tokens Used**: OpenAI API consumption
- **Embeddings**: Number of searchable text chunks

### **Step 2: Understand the Data**

```
Example After Testing:
┌─────────────────┬──────────┐
│ Metric          │ Value    │
├─────────────────┼──────────┤
│ Total Messages  │ 12       │
│ Total Sessions  │ 3        │
│ Tokens Used     │ 1,245    │
│ Embeddings      │ 23       │
│ Files Uploaded  │ 1        │
└─────────────────┴──────────┘
```

**What This Means**:
- **12 Messages**: 6 user questions + 6 bot responses  
- **3 Sessions**: 3 separate conversation threads
- **1,245 Tokens**: OpenAI API usage (text processing)
- **23 Embeddings**: 23 searchable text chunks from your document

---

## 🎯 **Next Steps**

### **🚀 Immediate Actions**

1. **Add More Documents**:
   - Upload additional training materials
   - Try different file formats (PDF, DOCX)
   - Organize by categories or topics

2. **Customize Further**:
   - Adjust bot personality and tone
   - Modify appearance and branding
   - Set up domain whitelisting

3. **Test Thoroughly**:
   - Try various question types
   - Test with different user scenarios
   - Validate response accuracy

### **📈 Scale Your Implementation**

1. **Production Deployment**:
   - Set up production environment variables
   - Deploy to Vercel, Netlify, or your hosting platform
   - Configure production database and vector storage

2. **Advanced Features**:
   - Set up team collaboration
   - Implement advanced analytics
   - Add multiple bots for different purposes

3. **Integration & Automation**:
   - Connect with your existing tools
   - Set up automated document updates
   - Implement custom workflows

### **📚 Learn More**

- **[API Reference](./api-reference.md)**: Complete API documentation
- **[Development Guide](./development.md)**: Advanced development topics
- **[Architecture Guide](./architecture.md)**: Technical implementation details
- **[Best Practices](./best-practices.md)**: Optimization and production tips

### **🤝 Get Help**

- **Documentation**: Browse our comprehensive guides
- **GitHub Issues**: Report bugs or request features
- **Discord Community**: Join discussions with other developers
- **Email Support**: Reach out to our technical team

---

## 🎉 **Congratulations!**

You've successfully:
- ✅ Set up a complete PlugRAG development environment
- ✅ Created your first AI-powered chatbot
- ✅ Trained it with your own documents
- ✅ Embedded it on a test website
- ✅ Monitored its performance with analytics

**Your chatbot is now ready to help users with intelligent, context-aware responses based on your knowledge base!**

---

<div align="center">

**Ready to build something amazing?**  
[View Advanced Examples](./examples) • [Join Our Community](https://discord.gg/plugrag) • [Star on GitHub](https://github.com/Kanishk2004/chat-bot)

</div>
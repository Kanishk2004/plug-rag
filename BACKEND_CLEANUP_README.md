# Chatbot Application - Backend Cleanup

## Summary

This application has been cleaned up to provide a basic boilerplate structure for a chatbot application. The complex backend logic has been removed, leaving you with clean foundations to build upon.

## What Was Kept

### ✅ Frontend (Intact)
- All React components in `src/components/`
- All dashboard pages in `src/app/dashboard/`
- Frontend layouts and styling
- React hooks in `src/hooks/`

### ✅ Basic Infrastructure
- Database models in `src/models/` (simplified)
- MongoDB connection (`src/lib/mongo.js`)
- Basic API utilities (`src/lib/api.js`)
- Next.js configuration files
- Package.json and dependencies

### ✅ API Route Structure
All API routes have been converted to basic boilerplates that return 501 (Not Implemented):
- `/api/bots` - Bot management
- `/api/chat/[botId]` - Chat functionality
- `/api/files` - File upload/management
- `/api/vectors` - Vector operations
- `/api/webhooks/clerk` - Authentication webhooks

## What Was Moved to Backup

### 📦 Complex Backend Logic (in `src/lib/backup/`)
- `embeddings.js` - OpenAI embedding generation
- `fileProcessingAPI.js` - File processing pipeline
- `performance.js` - Performance monitoring
- `qdrant.js` - Vector database operations
- `ragService.js` - RAG (Retrieval Augmented Generation) service
- `user.js` - User management and limits
- `vectorStorage.js` - Vector storage operations
- `extractors/` - File content extraction logic

### 🗃️ Original Complex API Routes (in `*_backup.js` files)
- All original API implementations with full business logic

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## Next Steps

Now you can implement the backend logic step by step:

1. **Start with Bot Management:**
   - Implement `POST /api/bots` for bot creation
   - Implement `GET /api/bots` for listing bots
   - Implement `PATCH/DELETE /api/bots/[id]` for bot updates/deletion

2. **Add File Management:**
   - Implement file upload in `POST /api/files`
   - Add file listing and deletion

3. **Implement Chat Functionality:**
   - Add basic chat responses in `POST /api/chat/[botId]`
   - Later integrate with OpenAI API

4. **Add Advanced Features:**
   - File processing and text extraction
   - Vector embeddings and similarity search
   - RAG implementation

## Available Models

Basic Mongoose models are ready to use:
- `Bot` - Bot configuration and metadata
- `User` - User accounts and preferences  
- `File` - Uploaded file records
- `Message` - Chat messages
- `Conversation` - Chat conversations
- `Chunk` - Document chunks (for RAG)
- `Job` - Background job tracking

## Architecture

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes (boilerplate)
│   ├── dashboard/         # Frontend dashboard pages
│   ├── globals.css        # Global styles
│   ├── layout.js          # Root layout
│   └── page.js            # Home page
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities
│   ├── backup/           # Complex logic (moved here)
│   ├── api.js            # Simple API utilities
│   └── mongo.js          # Database connection
└── models/               # MongoDB schemas
```

This structure gives you a clean foundation to implement your chatbot backend logic incrementally while keeping the frontend fully functional.
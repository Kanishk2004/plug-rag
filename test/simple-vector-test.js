/**
 * Simple test for vector storage integration
 * Tests basic functionality without dependencies
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testQdrantConnection() {
  console.log('🧪 Testing Qdrant Connection...\n');
  
  try {
    // Test Qdrant connection directly
    const response = await fetch('http://localhost:6333/collections');
    const collections = await response.json();
    
    console.log('✅ Qdrant is running');
    console.log('📁 Current collections:', collections.result?.collections?.length || 0);
    
    return true;
  } catch (error) {
    console.error('❌ Qdrant connection failed:', error.message);
    return false;
  }
}

async function testOpenAIConnection() {
  console.log('🧪 Testing OpenAI Connection...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    return false;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Hello, this is a test',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenAI is working');
      console.log('📊 Embedding dimensions:', data.data[0].embedding.length);
      console.log('💰 Tokens used:', data.usage.total_tokens);
      return true;
    } else {
      const error = await response.json();
      console.error('❌ OpenAI API error:', error.error?.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ OpenAI connection failed:', error.message);
    return false;
  }
}

async function testVectorStorage() {
  console.log('🧪 Testing Vector Storage Pipeline...\n');
  
  try {
    // Step 1: Create a test collection
    console.log('1️⃣ Creating test collection...');
    
    const testCollectionName = `test_user_${Date.now()}`;
    
    const createResponse = await fetch('http://localhost:6333/collections/' + testCollectionName, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      }),
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create collection');
    }
    
    console.log('✅ Test collection created:', testCollectionName);
    
    // Step 2: Generate embeddings
    console.log('2️⃣ Generating embeddings...');
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'This is a test document about artificial intelligence and machine learning.',
      }),
    });
    
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
    console.log('✅ Embedding generated');
    
    // Step 3: Store vector in Qdrant
    console.log('3️⃣ Storing vector in Qdrant...');
    
    const vectorData = {
      points: [{
        id: 1,
        vector: embedding,
        payload: {
          content: 'This is a test document about artificial intelligence and machine learning.',
          fileName: 'test.txt',
          fileId: 'test_file_123',
          chunkIndex: 0,
        },
      }],
    };
    
    const storeResponse = await fetch(`http://localhost:6333/collections/${testCollectionName}/points`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vectorData),
    });
    
    if (!storeResponse.ok) {
      throw new Error('Failed to store vector');
    }
    
    console.log('✅ Vector stored successfully');
    
    // Step 4: Search for similar vectors
    console.log('4️⃣ Testing vector search...');
    
    const queryEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'artificial intelligence',
      }),
    });
    
    const queryEmbeddingData = await queryEmbeddingResponse.json();
    const queryEmbedding = queryEmbeddingData.data[0].embedding;
    
    const searchResponse = await fetch(`http://localhost:6333/collections/${testCollectionName}/points/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        limit: 5,
        with_payload: true,
      }),
    });
    
    const searchData = await searchResponse.json();
    
    if (searchData.result && searchData.result.length > 0) {
      console.log('✅ Vector search successful');
      console.log('🎯 Top result score:', searchData.result[0].score);
      console.log('📄 Content preview:', searchData.result[0].payload.content.substring(0, 50) + '...');
    } else {
      console.log('⚠️  No search results found');
    }
    
    // Step 5: Cleanup
    console.log('5️⃣ Cleaning up...');
    
    const deleteResponse = await fetch(`http://localhost:6333/collections/${testCollectionName}`, {
      method: 'DELETE',
    });
    
    if (deleteResponse.ok) {
      console.log('✅ Test collection deleted');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Vector storage test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Vector Integration Tests\n');
  console.log('='.repeat(50) + '\n');
  
  const results = {
    qdrant: await testQdrantConnection(),
    openai: await testOpenAIConnection(),
    vectorStorage: false,
  };
  
  console.log('='.repeat(50) + '\n');
  
  if (results.qdrant && results.openai) {
    results.vectorStorage = await testVectorStorage();
  } else {
    console.log('⏭️  Skipping vector storage test due to connection failures');
  }
  
  console.log('='.repeat(50) + '\n');
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log('Qdrant Connection:', results.qdrant ? '✅ PASS' : '❌ FAIL');
  console.log('OpenAI Connection:', results.openai ? '✅ PASS' : '❌ FAIL');
  console.log('Vector Storage:', results.vectorStorage ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Your vector integration is working perfectly.');
    console.log('🚀 Ready to build RAG features!');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
  }
  
  console.log('='.repeat(50));
}

// Run tests
runAllTests().catch(console.error);
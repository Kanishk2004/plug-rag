import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import File from '@/models/File';
import Bot from '@/models/Bot';
import Job from '@/models/Job';
import { processFile, validateFile } from '@/lib/extractors';
import { PerformanceMonitor } from '@/lib/performance';
import { getCurrentDBUser, checkUserLimits } from '@/lib/user';

const MAX_BATCH_SIZE = 5;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

export async function POST(request) {
  try {
    PerformanceMonitor.startTimer('batch-processing-api');
    
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const botId = formData.get('botId');
    const options = JSON.parse(formData.get('options') || '{}');

    // Get all files from form data
    const files = [];
    let totalSize = 0;

    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      const file = formData.get(`file_${i}`);
      if (file) {
        files.push(file);
        totalSize += file.size;
      }
    }

    // Validate batch
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} files allowed per batch` },
        { status: 400 }
      );
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: `Total file size exceeds ${MAX_TOTAL_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get current user and check limits
    const user = await getCurrentDBUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate bot ownership
    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Check user limits
    const { limits } = await checkUserLimits(userId);
    if (limits.botsReached || limits.storageReached) {
      return NextResponse.json(
        { error: 'Plan limits reached', limits },
        { status: 429 }
      );
    }

    // Create batch job record
    const batchJobId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const batchJob = new Job({
      jobId: batchJobId,
      type: 'file-processing',
      userId,
      botId,
      status: 'active',
      data: {
        batchSize: files.length,
        totalSize,
        options,
      },
      progress: 0,
      attempts: 1,
      maxAttempts: 1,
    });
    await batchJob.save();

    // Process files
    const results = [];
    const errors = [];
    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Validate individual file
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const validation = validateFile(fileBuffer, file.name);

        if (!validation.isValid) {
          errors.push({
            filename: file.name,
            error: 'Validation failed',
            details: validation.errors,
          });
          continue;
        }

        // Check for duplicate
        const existingFile = await File.findOne({
          botId,
          originalName: file.name,
          status: { $ne: 'deleted' }
        });

        if (existingFile) {
          errors.push({
            filename: file.name,
            error: 'File already exists',
          });
          continue;
        }

        // Process file
        const processingOptions = {
          maxChunkSize: options.maxChunkSize || 700,
          overlap: options.overlap || 100,
          respectStructure: options.respectStructure !== false,
          ...options,
        };

        const extractedData = await processFile(fileBuffer, file.name, processingOptions);

        // Create file record
        const fileRecord = new File({
          botId,
          ownerId: userId,
          filename: generateUniqueFilename(file.name),
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileType: validation.detectedType,
          size: fileBuffer.length,
          status: 'completed',
          extractedText: extractedData.text,
          totalChunks: extractedData.chunks.length,
          totalTokens: extractedData.wordCount,
          embeddingStatus: 'pending',
          vectorCount: 0,
          metadata: {
            ...extractedData.metadata,
            processingOptions,
            batchJobId,
          },
          processedAt: new Date(),
        });

        await fileRecord.save();

        results.push({
          filename: file.name,
          fileId: fileRecord._id,
          status: 'success',
          totalChunks: extractedData.chunks.length,
          totalTokens: extractedData.wordCount,
        });

        processedCount++;

        // Update progress
        const progress = Math.round((processedCount / files.length) * 100);
        await Job.findByIdAndUpdate(batchJob._id, { progress });

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors.push({
          filename: file.name,
          error: 'Processing failed',
          details: error.message,
        });
      }
    }

    // Update batch job status
    const finalStatus = errors.length === files.length ? 'failed' : 'completed';
    await Job.findByIdAndUpdate(batchJob._id, {
      status: finalStatus,
      progress: 100,
      completedAt: new Date(),
      result: {
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors,
      },
    });

    // Update bot statistics
    if (results.length > 0) {
      const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);
      await Bot.findByIdAndUpdate(botId, {
        $inc: {
          fileCount: results.length,
          totalTokens: totalTokens,
        },
      });
    }

    const responseData = {
      success: true,
      batchJobId,
      summary: {
        totalFiles: files.length,
        successCount: results.length,
        errorCount: errors.length,
        totalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
      },
      results,
      errors,
    };

    PerformanceMonitor.endTimer('batch-processing-api');
    
    return NextResponse.json(responseData, { 
      status: results.length > 0 ? 201 : 400 
    });

  } catch (error) {
    PerformanceMonitor.endTimer('batch-processing-api', 'error');
    console.error('Batch processing API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const batchJobId = url.searchParams.get('batchJobId');

    if (!batchJobId) {
      return NextResponse.json(
        { error: 'batchJobId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find batch job
    const batchJob = await Job.findOne({
      jobId: batchJobId,
      userId,
      type: 'file-processing',
    });

    if (!batchJob) {
      return NextResponse.json(
        { error: 'Batch job not found' },
        { status: 404 }
      );
    }

    const responseData = {
      success: true,
      batchJob: {
        id: batchJob.jobId,
        status: batchJob.status,
        progress: batchJob.progress,
        data: batchJob.data,
        result: batchJob.result,
        createdAt: batchJob.createdAt,
        completedAt: batchJob.completedAt,
        error: batchJob.error,
      },
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Get batch job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate unique filename to prevent conflicts
 */
function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalFilename.split('.').pop();
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
  
  return `${nameWithoutExt}_${timestamp}_${random}.${extension}`;
}
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupportedFileTypes } from '@/lib/extractors';

export async function GET(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supportedTypes = getSupportedFileTypes();
    
    const responseData = {
      success: true,
      supportedFileTypes: supportedTypes,
      limits: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFilesPerBot: 10,
        allowedExtensions: Object.values(supportedTypes)
          .flatMap(type => type.extensions),
        allowedMimeTypes: Object.values(supportedTypes)
          .flatMap(type => type.mimeTypes),
      },
      processingOptions: {
        chunking: {
          maxChunkSize: {
            default: 700,
            min: 200,
            max: 1500,
            description: 'Number of tokens per chunk'
          },
          overlap: {
            default: 100,
            min: 0,
            max: 300,
            description: 'Overlap tokens between chunks'
          },
          respectStructure: {
            default: true,
            description: 'Preserve document structure in chunking'
          }
        },
        pdf: {
          maxPages: {
            default: 100,
            max: 500,
            description: 'Maximum pages to process'
          },
          preserveFormatting: {
            default: false,
            description: 'Preserve original formatting'
          }
        },
        docx: {
          includeHeaders: {
            default: true,
            description: 'Include document headers'
          },
          includeFooters: {
            default: false,
            description: 'Include document footers'
          },
          extractImages: {
            default: false,
            description: 'Extract image descriptions'
          }
        },
        html: {
          timeout: {
            default: 30000,
            max: 60000,
            description: 'Request timeout in milliseconds'
          },
          maxContentLength: {
            default: 1000000,
            max: 5000000,
            description: 'Maximum content size in bytes'
          },
          extractLinks: {
            default: false,
            description: 'Extract and include links'
          }
        },
        csv: {
          hasHeader: {
            default: true,
            description: 'First row contains headers'
          },
          maxRows: {
            default: 10000,
            max: 50000,
            description: 'Maximum rows to process'
          },
          delimiter: {
            default: 'auto',
            options: ['auto', ',', ';', '\t', '|'],
            description: 'Column delimiter'
          }
        },
        txt: {
          encoding: {
            default: 'utf8',
            options: ['utf8', 'latin1', 'ascii'],
            description: 'Text encoding'
          },
          detectStructure: {
            default: true,
            description: 'Detect document structure'
          }
        }
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Get processing info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
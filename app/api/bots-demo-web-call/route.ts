import { NextRequest, NextResponse } from 'next/server';
import { defaultBotProfile, defaultMaxDuration } from '@/config/rtvi.config';
import { getSecurityHeaders } from '@/app/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { services, config } = body;
    console.log('Request body:', { services, config });

    if (!services || !config || !process.env.DAILY_BOTS_URL) {
      console.log('Missing required data:', {
        services,
        config,
        DAILY_BOTS_URL: process.env.DAILY_BOTS_URL,
      });
      return new NextResponse(
        'Services or config not found on request body',
        {
          status: 400,
          headers: getSecurityHeaders(),
        }
      );
    }

    const payload = {
      bot_profile: defaultBotProfile,
      max_duration: defaultMaxDuration,
      services,
      api_keys: {
        openai: process.env.OPENAI_API_KEY,
      },
      config,
    };

    // Convert the config object to the expected array format
    Object.entries(config).forEach(([service, options]) => {
      Object.entries(options as Record<string, unknown>).forEach(([key, value]) => {
        (payload.config as Array<unknown>).push({
          service,
          options: [{ name: key, value }],
        });
      });
    });

    const req = await fetch(process.env.DAILY_BOTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const res = await req.json();

    if (req.status !== 200) {
      console.log('Error response from Daily API:', res);
      return NextResponse.json(res, {
        status: req.status,
        headers: getSecurityHeaders(),
      });
    }

    return NextResponse.json(res, {
      headers: getSecurityHeaders(),
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: getSecurityHeaders(),
    });
  }
} 
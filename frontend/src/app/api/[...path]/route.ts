import { NextRequest, NextResponse } from 'next/server';

// BACKEND_URL é resolvido em runtime (não build time), então funciona em Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/${path}${search}`;

  // Propaga todos os headers (incluindo Cookie para JWT httpOnly)
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Evita headers que o fetch resolve automaticamente
    if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const isBodyMethod = !['GET', 'HEAD'].includes(req.method);

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: isBodyMethod ? req.body : undefined,
    // @ts-expect-error duplex needed for streaming body
    duplex: isBodyMethod ? 'half' : undefined,
  });

  // Propaga headers de resposta (incluindo Set-Cookie)
  const resHeaders = new Headers();
  response.headers.forEach((value, key) => {
    resHeaders.set(key, value);
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: resHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

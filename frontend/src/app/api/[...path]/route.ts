import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const isBodyMethod = !['GET', 'HEAD'].includes(req.method);

  let body: Uint8Array | undefined;
  if (isBodyMethod) {
    // Bufferiza o body para que o Express receba Content-Length correto
    const ab = await req.arrayBuffer();
    body = new Uint8Array(ab);
    if (body.length > 0) {
      headers.set('content-length', String(body.length));
    }
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  });

  // Propaga headers de resposta (incluindo Set-Cookie para o JWT httpOnly)
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

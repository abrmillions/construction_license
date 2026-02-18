import { NextResponse } from 'next/server'
import { DJANGO_API_URL } from '@/lib/config/django-api'

export async function GET(request: Request) {
  const incoming = new URL(request.url)
  const target = new URL('/api/licenses/verify/', DJANGO_API_URL)
  target.search = incoming.search
  const res = await fetch(target.toString(), {
    method: 'GET',
    headers: request.headers,
    redirect: 'manual',
  })
  const body = await res.arrayBuffer()
  return new NextResponse(new Uint8Array(body), { status: res.status, headers: res.headers })
}

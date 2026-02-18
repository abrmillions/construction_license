import { proxyToDjango } from '@/lib/api/django-proxy'

export async function GET(request: Request, { params }: { params: { cert: string } }) {
  return proxyToDjango(request, `/api/partnerships/verify-cert/${params.cert}/`)
}

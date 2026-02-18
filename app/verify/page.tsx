"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Building2, QrCode, Search, CheckCircle2, XCircle, FileText } from "lucide-react"
import Link from "next/link"
import QRScanner from "@/components/qr-scanner"
import djangoApi, { licensesApi, applicationsApi } from "@/lib/api/django-client"
import { generateQRDataURL, createVerificationUrl, parseQRData, createLicenseQRPayload } from "@/lib/qr/qr-utils"
import { generateLicensePDF } from "@/lib/downloads/pdf-generator"
import { downloadPDF } from "@/lib/downloads/file-download"
// added now
// import { useToast } from "@/hooks/use-toast"

interface VerificationResult {
  valid: boolean;
  id?: string;
  license_number?: string;
  holder_name?: string;
  status?: string;
  expiry_date?: string;
  detail?: string;
}

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const initialLicenseNumber = searchParams.get('licenseNumber') || ''

  const [licenseNumber, setLicenseNumber] = useState(initialLicenseNumber)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const localVerify = async (targetNumber?: string) => {
    const num = String(targetNumber || licenseNumber || '').trim()
    if (!num) return false
    try {
      const all: any[] = await licensesApi.list()
      const target = (all || []).find((lic) => {
        const n = String(
          lic.license_number ||
            (lic.data && (lic.data.licenseNumber || lic.data.registrationNumber)) ||
            ''
        ).trim()
        return n.toUpperCase() === num.toUpperCase()
      })
      if (target) {
        const st = String(target.status || '').toLowerCase()
        const notExpired = !target.expiry_date || new Date(target.expiry_date) >= new Date()
        if (st === 'active' || st === 'approved') {
          if (notExpired) {
            setLicenseNumber(num)
            setVerificationResult({
              found: true,
              data: {
                licenseId: target.id,
                licenseNumber: num,
                holderName: target.holder_name || (target.owner && target.owner.email) || '',
                companyName: target.data?.companyName || '',
                licenseType: target.license_type || '',
                issueDate: target.issued_date || target.data?.issueDate || 'N/A',
                expiryDate: target.expiry_date || target.data?.expiryDate || 'N/A',
                authorizedScope: target.license_type || '',
                status: target.status || 'active',
                verified: true,
              },
            })
            return true
          }
        }
      }
    } catch {}
    return false
  }

  const runVerification = async (options: { licenseNumber?: string; token?: string }) => {
    if (!options.licenseNumber && !options.token) return

    setIsSearching(true)
    setError(null)

    try {
      const result = await djangoApi.verifyLicense(options)
      
      if (result.valid) {
        // Ensure the input shows the verified license number
        if (result.license_number) {
          setLicenseNumber(result.license_number)
        }
        
        // Format license type for display
        const formatLicenseType = (type: string, subtype?: string) => {
          if (!type) return "Construction License"
          const typeMap: Record<string, string> = {
            contractor: "Contractor License",
            professional: "Professional License",
            vehicle: "Vehicle License"
          }
          const baseType = typeMap[type.toLowerCase()] || type
          if (subtype) {
            // Capitalize first letter of each word in subtype
            const formattedSubtype = subtype.split(/[-_\s]/).map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
            return `${baseType} - Grade ${formattedSubtype}`
          }
          return baseType
        }
        
        setVerificationResult({
          found: true,
          data: {
            licenseId: result.id,
            licenseNumber: result.license_number,
            holderName: result.holder_name || "N/A",
            companyName: result.company_name || "",
            licenseType: formatLicenseType(result.license_type, result.subtype),
            issueDate: result.issued_date || "N/A",
            expiryDate: result.expiry_date || "N/A",
            authorizedScope: result.authorized_scope || result.license_type || "General Construction",
            status: result.status || "active",
            verified: true,
          },
        })
      } else {
        const ok = await localVerify(options.licenseNumber)
        if (!ok) {
          setVerificationResult({ found: false, data: null })
          setError(result.detail || "The license number you entered was not found in the database.")
        }
      }
    } catch (error: any) {
      const ok = await localVerify(options.licenseNumber)
      if (!ok) {
        setVerificationResult({
          found: false,
          data: null,
        })
        setError(error?.message || 'An error occurred during verification.')
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    await runVerification({ licenseNumber })
  }

  // When arriving from a verification URL, automatically populate and verify
  useEffect(() => {
    const token = searchParams.get('token')

    // Prefer token-based verification (from signed verification URLs)
    if (token) {
      void runVerification({ token })
    } else if (initialLicenseNumber) {
      // If licenseNumber is present in the URL, auto-verify with it
      void runVerification({ licenseNumber: initialLicenseNumber })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLicenseNumber, searchParams])

  const handleQRScan = (qrData: string) => {
    const parsed = parseQRData(qrData)
    if (parsed?.licenseNumber) {
      setLicenseNumber(parsed.licenseNumber)
      setShowScanner(false)
      void runVerification({ licenseNumber: parsed.licenseNumber })
    } else {
      setError('Could not extract a valid license number from the QR code.')
      setShowScanner(false)
    }
  }

  const handleDownloadCertificate = async () => {
    if (!verificationResult?.found || !verificationResult.data) return

    try {
      const data = verificationResult.data
      const regNumber = data.licenseNumber || licenseNumber
      if (!regNumber) {
        setError("License number is missing; cannot generate certificate.")
        return
      }

      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      const verificationUrl = createVerificationUrl(baseUrl, String(regNumber), String(regNumber))
      // Prefer backend-supplied dates; fall back to fixed certificate defaults
      const defaultIssueIso = new Date("2026-02-15T00:00:00Z").toISOString()
      const defaultExpiryIso = new Date("2031-02-15T00:00:00Z").toISOString()
      const issueIso =
        (data.issueDate && data.issueDate !== "N/A" ? String(data.issueDate) : defaultIssueIso)
      const expiryIso =
        (data.expiryDate && data.expiryDate !== "N/A" ? String(data.expiryDate) : defaultExpiryIso)

      const payload = createLicenseQRPayload({
        licenseId: String(data.licenseId ?? regNumber),
        licenseNumber: String(regNumber),
        holderName: data.holderName || "",
        companyName: data.companyName || "",
        type: data.licenseType || "Construction License",
        issueDate: issueIso,
        expiryDate: expiryIso,
        verificationUrl,
      })
      const qrDataUrl = await generateQRDataURL(JSON.stringify(payload))

      const pdf = await generateLicensePDF({
        id: String(data.licenseId ?? regNumber),
        type: data.licenseType || "Construction License",
        category: "License",
        holderName: data.holderName || "",
        companyName: data.companyName || "",
        registrationNumber: String(regNumber),
        issueDate: issueIso,
        expiryDate: expiryIso,
        status: data.status || "active",
        qrDataUrl,
        verificationUrl,
      })

      downloadPDF(pdf, `License-${regNumber}.pdf`)
    } catch (err: any) {
      console.error("Certificate download error:", err)
      setError(err?.message || "Failed to download verification certificate.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">CLMS</h1>
              <p className="text-xs text-muted-foreground">License Verification Portal</p>
            </div>
          </Link>
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Verify Construction License</h2>
          <p className="text-muted-foreground">Enter a license number or scan the QR code to verify authenticity</p>
        </div>

        {!showScanner ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>License Verification</CardTitle>
              <CardDescription>Verify contractor licenses, professional certifications, and permits</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="licenseNumber"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="Enter license number (e.g., LIC-2026-000123)"
                      className="flex-1"
                      required
                    />
                    <Button type="submit" disabled={isSearching}>
                      <Search className="w-4 h-4 mr-2" />
                      {isSearching ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <div className="flex-1 border-t border-border"></div>
                  <span className="text-sm text-muted-foreground">OR</span>
                  <div className="flex-1 border-t border-border"></div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowScanner(true)}
                  className="w-full bg-transparent"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Scan QR Code with Camera
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-center mb-8">
            <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
          </div>
        )}

        {verificationResult && (
          <Card className={verificationResult.found ? "border-accent" : "border-destructive"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {verificationResult.found ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      License Verified
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-destructive" />
                      License Not Found
                    </>
                  )}
                </CardTitle>
                {verificationResult.found && (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {verificationResult.found ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">License Number:</span>
                      <p className="font-medium text-foreground">{verificationResult.data.licenseNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Holder Name:</span>
                      <p className="font-medium text-foreground">{verificationResult.data.holderName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">License Type:</span>
                      <p className="font-medium text-foreground">{verificationResult.data.licenseType}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Issue Date:</span>
                      <p className="font-medium text-foreground">{verificationResult.data.issueDate}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expiry Date:</span>
                      <p className="font-medium text-foreground">{verificationResult.data.expiryDate}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Authorized Scope:</span>
                      <p className="font-medium text-foreground">{verificationResult.data.authorizedScope || verificationResult.data.scope}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">License is valid and verified</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This license has been issued by the Construction Licensing Authority and is currently active.
                      </p>
                    </div>
                  </div>

                  {/* <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-transparent"
                    disabled={!verificationResult?.found}
                    onClick={handleDownloadCertificate}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Download Verification Certificate
                  </Button> */}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    The license number you entered was not found in our database.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please verify the license number and try again, or contact support for assistance.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

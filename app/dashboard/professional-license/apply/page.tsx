"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { GraduationCap, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ProfessionalStep1 } from "@/components/licenses/professional/step1-personal"
import { ProfessionalStep2 } from "@/components/licenses/professional/step2-qualifications"
import { ProfessionalStep3 } from "@/components/licenses/professional/step3-experience"
import { ProfessionalStep4 } from "@/components/licenses/professional/step4-documents"
import { ProfessionalStep5 } from "@/components/licenses/professional/step5-review"
import { applicationsApi } from "@/lib/api/django-client"

export default function ProfessionalLicenseApplyPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState("")
  const [canApply, setCanApply] = useState(true)
  const [formData, setFormData] = useState({
    // Personal Info
    fullName: "",
    email: "",
    phone: "",
    nationalId: "",
    dateOfBirth: "",
    address: "",

    // Qualifications
    profession: "",
    specialization: "",
    degree: "",
    university: "",
    graduationYear: "",
    licenseNumber: "",

    // Experience
    yearsOfExperience: "",
    currentEmployer: "",
    position: "",
    projects: [] as any[],

    // Documents
    professional_photo: null,
    documents: {
      nationalIdCopy: null,
      degreeCertificate: null,
      transcripts: null,
      experienceLetter: null,
      professionalPhoto: null,
      previousLicense: null,
    },
  })

  const steps = [
    { number: 1, title: "Personal Info", description: "Basic details" },
    { number: 2, title: "Qualifications", description: "Education & credentials" },
    { number: 3, title: "Experience", description: "Work history" },
    { number: 4, title: "Documents", description: "Required files" },
    { number: 5, title: "Review", description: "Confirm & submit" },
  ]

  const progress = (currentStep / steps.length) * 100

  const updateFormData = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setError("")
    if (!canApply) {
      const msg = 'You already hold a professional license and cannot apply again.'
      setError(msg)
      alert(msg)
      return
    }
    try {
      const payload: any = {
        license_type: "Professional License",
        data: { ...formData, professional_photo: undefined },
      }
      if (formData.professional_photo instanceof File) {
        payload.professional_photo = formData.professional_photo
      }
      const application = await applicationsApi.create(payload)

      try {
        const appId = String(application?.id || '')
        if (appId) {
          const docs = formData.documents || {}
          const keys = Object.keys(docs)
          for (const k of keys) {
            const v: any = (docs as any)[k]
            if (v instanceof File) {
              try {
                await (await import('@/lib/api/django-client')).documentsApi.upload(v, appId)
              } catch (e) {
                /* continue uploading other files */
              }
            }
          }
        }
      } catch {
        /* ignore upload errors, application already created */
      }

      console.log("[v0] Professional application submitted:", application)
      router.push("/dashboard/applications")
    } catch (err: any) {
      let message = err?.message || "Failed to submit application"
      if (err?.error && typeof err.error === 'object') {
        const fieldErrors = Object.entries(err.error)
          .map(([field, messages]: [string, any]) => {
            if (Array.isArray(messages)) return `${field}: ${messages.join(', ')}`
            if (typeof messages === 'object') return `${field}: ${JSON.stringify(messages)}`
            return `${field}: ${messages}`
          })
          .join('\n')
        message = fieldErrors || message
      }
      const lc = String(message || '').toLowerCase()
      if (lc.includes('active application')) {
        setError('You already have an active professional license application.')
        router.push("/dashboard/applications")
        return
      }
      setError(message)
      alert(message)
    }
  }

  // Prevent showing the application form if the user already has a professional license
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const existing = await (await import("@/lib/api/django-client")).licensesApi.list()
        if (!mounted) return
        if (Array.isArray(existing) && existing.some((l: any) => l.license_type === 'Professional License')) {
          setCanApply(false)
          setError('You already hold a professional license and cannot apply again.')
        }
        const apps = await (await import("@/lib/api/django-client")).applicationsApi.list()
        if (!mounted) return
        const active = Array.isArray(apps) && apps.some((a: any) => {
          const t = String(a.license_type || '').toLowerCase()
          const s = String(a.status || '').toLowerCase()
          const activeStatuses = ['pending', 'processing', 'submitted', 'in_review', 'under_review']
          return t.includes('professional') && activeStatuses.includes(s)
        })
        if (active) {
          setCanApply(false)
          setError('You already have an active professional license application.')
        }
      } catch (e) {
        /* ignore — server will enforce */
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Professional License Application</h1>
              <p className="text-xs text-muted-foreground">
                Step {currentStep} of {steps.length}
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="grid grid-cols-5 gap-2">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div
                  className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center font-semibold text-sm ${
                    currentStep >= step.number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.number}
                </div>
                <div
                  className={`text-xs font-medium ${
                    currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 text-sm text-destructive whitespace-pre-wrap">{error}</div>}
            {currentStep === 1 && <ProfessionalStep1 data={formData} updateData={updateFormData} onNext={handleNext} />}
            {currentStep === 2 && (
              <ProfessionalStep2 data={formData} updateData={updateFormData} onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 3 && (
              <ProfessionalStep3 data={formData} updateData={updateFormData} onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 4 && (
              <ProfessionalStep4 data={formData} updateData={updateFormData} onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 5 && <ProfessionalStep5 data={formData} onBack={handleBack} onSubmit={handleSubmit} />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

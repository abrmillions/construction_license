 "use client";
 
 import { useEffect, useState } from "react";
 import { useRouter, useSearchParams } from "next/navigation";
 import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { authApi } from "@/lib/api/django-client";
 import { useAuth } from "@/lib/auth/auth-context";
 import { Loader2, MailCheck, AlertCircle } from "lucide-react";
 
 export default function VerifyEmailPage() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const { isAuthenticated } = useAuth();
 
   const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
   const [message, setMessage] = useState<string>("");
 
   useEffect(() => {
     const uid = searchParams.get("uid");
     const token = searchParams.get("token");
 
     if (!uid || !token) {
       setStatus("error");
       setMessage("Invalid verification link. Missing uid or token.");
       return;
     }
 
     const run = async () => {
       setStatus("loading");
       try {
         const resp = await authApi.confirmEmailVerification(uid, token);
         const detail = (resp && resp.detail) || "Email has been verified successfully.";
         setMessage(detail);
         setStatus("success");
       } catch (e: any) {
         const detail =
           e?.error?.detail ||
           e?.message ||
           "Verification failed. The link may be invalid or expired.";
         setMessage(String(detail));
         setStatus("error");
       }
     };
 
     void run();
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [searchParams]);
 
   const goNext = () => {
     if (isAuthenticated) {
       router.push("/dashboard");
     } else {
       router.push("/login");
     }
   };
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
       <Card className="w-full max-w-md">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             {status === "success" ? (
               <MailCheck className="h-5 w-5 text-green-600" />
             ) : status === "error" ? (
               <AlertCircle className="h-5 w-5 text-red-600" />
             ) : (
               <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
             )}
             Verify Email
           </CardTitle>
           <CardDescription>Confirm your email address to secure your account</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           {status === "loading" && (
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <Loader2 className="h-4 w-4 animate-spin" />
               Verifying your email…
             </div>
           )}
 
           {status === "success" && (
             <Alert>
               <AlertDescription>{message || "Your email is verified."}</AlertDescription>
             </Alert>
           )}
 
           {status === "error" && (
             <Alert variant="destructive">
               <AlertDescription>{message || "Verification failed."}</AlertDescription>
             </Alert>
           )}
         </CardContent>
         <CardFooter className="flex justify-end">
           {status !== "loading" && (
             <Button onClick={goNext}>
               {isAuthenticated ? "Go to Dashboard" : "Go to Login"}
             </Button>
           )}
         </CardFooter>
       </Card>
     </div>
   );
 }
 

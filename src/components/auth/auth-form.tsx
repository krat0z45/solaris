
"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { initiateEmailSignIn, initiateEmailSignUp } from "@/firebase/non-blocking-login";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { FirebaseError } from "firebase/app";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { doc, setDoc } from "firebase/firestore";
import type { UserCredential } from "firebase/auth";

type AuthMode = "login" | "register";

function SubmitButton({ mode }: { mode: AuthMode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Processing..." : mode === "login" ? "Login to your account" : "Create Account"}
    </Button>
  );
}

// This function now correctly returns all necessary fields for registration.
async function authenticate(
  mode: AuthMode,
  prevState: any,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string | null;
  const role = formData.get("role") as string | null;
  
  if (!email || !password || password.length < 6) {
    return {
      success: false,
      message: "Please enter a valid email and a password of at least 6 characters.",
    };
  }

  if (mode === "register" && (!name || !role)) {
    return {
      success: false,
      message: "Please enter your name and select a role.",
    };
  }

  return { success: true, message: "Processing...", email, password, name, role, mode };
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const [state, formAction] = useActionState(authenticate.bind(null, mode), null);
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const handleAuthSuccess = (userCredential: UserCredential) => {
    router.push('/dashboard');
  };
  
  const handleSignUpSuccess = (userCredential: UserCredential) => {
    if (!state?.email || !state?.name || !state?.role || !firestore) {
      handleAuthError({ code: 'internal-error', message: 'Missing form state for signup.'} as FirebaseError);
      return;
    }
    
    const userDocRef = doc(firestore, "users", userCredential.user.uid);
    const userData = {
        id: userCredential.user.uid,
        name: state.name,
        email: state.email,
        role: state.role,
        avatarUrl: `https://i.pravatar.cc/150?u=${userCredential.user.uid}`
    };

    setDoc(userDocRef, userData)
      .then(() => {
        router.push('/dashboard');
      })
      .catch((error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'create',
                requestResourceData: userData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            handleAuthError(error as FirebaseError);
        }
      });
  };

  const handleAuthError = (error: FirebaseError) => {
    let message = "An unexpected error occurred. Please try again.";
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password. Please try again.';
    } else if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please log in.';
    } else if (error.code === 'permission-denied') {
        message = 'You do not have permission to perform this action.';
    }
    
    toast({
      variant: "destructive",
      title: "Authentication Failed",
      description: message,
    });
  }

  useEffect(() => {
    if (state?.success && state.email && state.password) {
      if (state.mode === 'login') {
        initiateEmailSignIn(auth, state.email, state.password, handleAuthSuccess, handleAuthError);
      } else if (state.mode === 'register') {
        initiateEmailSignUp(auth, state.email, state.password, handleSignUpSuccess, handleAuthError);
      }
    } else if (state && !state.success) {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: state.message,
      });
    }
  }, [state, auth, toast, router]);


  return (
    <div className="mx-auto grid w-full max-w-sm gap-6">
       <div className="grid gap-2 text-left">
            <h1 className="text-3xl font-bold">
                {mode === "login" ? "Login" : "Create an Account"}
            </h1>
            <p className="text-balance text-muted-foreground">
                {mode === "login"
                ? "Enter your credentials to access your account."
                : "Fill in the details to create a new account."}
            </p>
        </div>
        <form action={formAction} className="grid gap-4">
        {mode === "register" && (
                <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" type="text" placeholder="e.g. Jane Doe" required />
            </div>
        )}
        <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
            id="email"
            name="email"
            type="email"
            placeholder="john@example.com"
            required
            />
        </div>
        <div className="grid gap-2">
            <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            </div>
            <Input id="password" name="password" type="password" placeholder="At least 8 characters" required />
        </div>
        {mode === "register" && (
                <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" required>
                    <SelectTrigger id="role">
                        <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        )}
        <SubmitButton mode={mode} />
        </form>
        <div className="mt-4 text-center text-sm">
        {mode === "login" ? (
            <>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="underline">
                Sign up
            </Link>
            </>
        ) : (
            <>
            Already have an account?{" "}
            <Link href="/login" className="underline">
                Log in
            </Link>
            </>
        )}
        </div>
    </div>
  );
}

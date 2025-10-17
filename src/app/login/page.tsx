
import AuthForm from "@/components/auth/auth-form";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full">
      <Image
        src="/fondo.jpg"
        alt="Background"
        fill
        className="object-cover -z-10"
        data-ai-hint="background building"
      />
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl grid lg:grid-cols-2 overflow-hidden">
          <div className="relative h-full hidden lg:flex flex-col items-center justify-center bg-destructive p-8 text-destructive-foreground">
              <Image
                  src="/acciona_login.png"
                  width={300}
                  height={300}
                  alt="Company Logo"
                  className="invert"
                  data-ai-hint="logo"
              />
          </div>

          <div className="p-8 lg:p-12 flex items-center justify-center">
            <AuthForm mode="login" />
          </div>
        </div>
      </div>
    </div>
  );
}

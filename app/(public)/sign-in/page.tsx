"use client"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function SignIn() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const signIn = async () => {
        setLoading(true)
        const { data, error } = await authClient.signIn.email({
            email,
            password
        })
        if (data) {
            toast.success("Signed in successfully")
            router.push("/documents")
        }
        if (error) {
            toast.error(error.statusText || "Error signing in")
        }
        setLoading(false)
    }

    return (
        <div className="flex flex-col gap-4 p-10 max-w-md mx-auto mt-20 border rounded-lg bg-background">
            <h1 className="text-2xl font-bold">Sign In</h1>
            <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <Button onClick={signIn} disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
        </div>
    )
}

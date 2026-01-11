"use client"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function SignUp() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const signUp = async () => {
        setLoading(true)
        const { data, error } = await authClient.signUp.email({
            email,
            password,
            name
        })
        if (data) {
            toast.success("Account created successfully")
            router.push("/documents")
        }
        if (error) {
            toast.error(error.statusText || "Error signing up")
        }
        setLoading(false)
    }

    return (
        <div className="flex flex-col gap-4 p-10 max-w-md mx-auto mt-20 border rounded-lg bg-background">
            <h1 className="text-2xl font-bold">Sign Up</h1>
            <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <Button onClick={signUp} disabled={loading}>{loading ? "Signing up..." : "Sign Up"}</Button>
        </div>
    )
}

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const validUsername = "nutri"
  const validPassword = "soygabi33"

  if (username === validUsername && password === validPassword) {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}

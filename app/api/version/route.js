import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const packagePath = path.join(process.cwd(), "package.json");
    const raw = await readFile(packagePath, "utf-8");
    const pkg = JSON.parse(raw);
    return NextResponse.json(
      {
        version: pkg.version || "0.0.0",
        name: pkg.name || "lol-tracker"
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load version." },
      { status: 500 }
    );
  }
}

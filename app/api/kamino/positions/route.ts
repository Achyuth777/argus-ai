import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();
    new PublicKey(walletAddress);
    // V1's SDK path was disabled. Never turn unavailable data into a healthy portfolio.
    return NextResponse.json(
      {
        error:
          "Live Kamino indexing is not configured. Wallet connection is real; no position or safety assessment is available. Explore Demo to try the risk engine.",
        code: "INTEGRATION_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  } catch {
    return NextResponse.json(
      { error: "A valid Solana wallet address is required" },
      { status: 400 },
    );
  }
}

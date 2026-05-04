import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * POST /store/auth/google-signin
 * Called server-side from NextAuth when a user authenticates with Google.
 * Finds or creates the Medusa customer + auth identity, returns a Medusa JWT.
 * Protected by a shared GOOGLE_BRIDGE_SECRET (never exposed to the client).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, firstName, lastName, googleId, bridgeSecret } = req.body as {
    email: string;
    firstName: string;
    lastName: string;
    googleId: string;
    bridgeSecret: string;
  };

  if (!email || !googleId || !bridgeSecret) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (bridgeSecret !== process.env.GOOGLE_BRIDGE_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const customerModule = req.scope.resolve(Modules.CUSTOMER);
    const authModule = req.scope.resolve(Modules.AUTH);

    // 1. Find existing customer by email
    const existingCustomers = await customerModule.listCustomers({ email });
    let customer = existingCustomers[0];

    // 2. Create customer if doesn't exist
    if (!customer) {
      customer = await customerModule.createCustomers({
        email,
        first_name: firstName || "",
        last_name: lastName || "",
      });
    }

    // 3. Find or create a Google auth identity for this customer
    const identities = await authModule.listAuthIdentities({
      provider_identities: { entity_id: googleId, provider: "google" },
    });
    let authIdentity = identities[0];

    if (!authIdentity) {
      authIdentity = await authModule.createAuthIdentities({
        provider_identities: [
          {
            entity_id: googleId,
            provider: "google",
          },
        ],
        app_metadata: { actor_id: customer.id, actor_type: "customer" },
      });
    }

    // 4. Sign a Medusa-compatible JWT for this customer
    const jwtSecret = process.env.JWT_SECRET || "supersecret";

    const token = jwt.sign(
      {
        actor_id: customer.id,
        actor_type: "customer",
        auth_identity_id: authIdentity.id,
        jti: crypto.randomUUID(),
        app: "store",
      },
      jwtSecret,
      { expiresIn: "30d" }
    );

    return res.json({ token, customer_id: customer.id });
  } catch (err) {
    console.error("[Google Bridge] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}

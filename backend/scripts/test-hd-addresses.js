/**
 * Script to verify HD address creation.
 * Run from backend dir with server up: node scripts/test-hd-addresses.js
 * Optional env: BASE_URL, EMAIL, PASSWORD (defaults: localhost:3000, test@example.com, password123)
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.EMAIL || "test@example.com";
const PASSWORD = process.env.PASSWORD || "password123";

async function request(method, path, body = null, token = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText || `HTTP ${res.status}`);
  return data;
}

async function main() {
  console.log("Testing HD address creation...");
  console.log("Base URL:", BASE_URL, "| Email:", EMAIL);

  let token;

  // 1. Signin (assume user exists; signup first if needed)
  try {
    const auth = await request("POST", "/api/auth/signin", { email: EMAIL, password: PASSWORD });
    token = auth.accessToken || auth.data?.accessToken;
    if (!token) throw new Error("No accessToken in signin response");
    console.log("✓ Signin OK");
  } catch (e) {
    console.error("✗ Signin failed:", e.message);
    console.log("  Create a user first: POST /api/auth/signup with email/password, then run again.");
    process.exit(1);
  }

  // 2. Init mnemonic
  try {
    const init = await request("POST", "/api/secrets/init-mnemonic", { network: "POLYGON_AMOY" }, token);
    const hasMnemonic = init.data?.hasMnemonic ?? init.hasMnemonic;
    if (!hasMnemonic) throw new Error("hasMnemonic not true");
    console.log("✓ Init mnemonic OK (walletId:", init.data?.walletId ?? init.walletId, ")");
  } catch (e) {
    console.error("✗ Init mnemonic failed:", e.message);
    if (e.message.includes("503") || e.message.includes("MASTER_KEY")) {
      console.log("  Set MASTER_KEY in backend/.env (min 16 chars) and restart server.");
    }
    process.exit(1);
  }

  // 3. Derive two addresses
  const addresses = [];
  for (let i = 0; i < 2; i++) {
    try {
      const derived = await request(
        "POST",
        "/api/secrets/derive-address",
        {
          network: "POLYGON_AMOY",
          asset: "USDT",
          label: `test-${i + 1}`,
          setDefault: i === 0,
        },
        token
      );
      const addr = derived.address ?? derived.data?.address;
      const index = derived.index ?? derived.data?.index;
      if (!addr) throw new Error("No address in response");
      addresses.push(addr);
      console.log(`✓ Derive address ${i + 1} OK → index ${index}, address ${addr.slice(0, 10)}...`);
    } catch (e) {
      console.error(`✗ Derive address ${i + 1} failed:`, e.message);
      process.exit(1);
    }
  }

  // 4. List addresses and verify
  try {
    const list = await request("GET", "/api/secrets/addresses?network=POLYGON_AMOY&asset=USDT", null, token);
    const items = list.data ?? list;
    if (!Array.isArray(items)) throw new Error("Expected array in response");
    if (items.length < 2) throw new Error(`Expected at least 2 addresses, got ${items.length}`);
    console.log("✓ List addresses OK, count:", items.length);
    items.forEach((it, i) => {
      console.log(`  [${i}] index=${it.index} address=${it.address?.slice(0, 14)}... label=${it.label} isDefault=${it.isDefault}`);
    });
  } catch (e) {
    console.error("✗ List addresses failed:", e.message);
    process.exit(1);
  }

  console.log("\nDone. Addresses are being created and stored correctly.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

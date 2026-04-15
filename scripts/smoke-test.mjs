const base = process.env.VAULT_API_BASE ?? "http://localhost:4000/api/v1/vault";
const apiKey = process.env.VAULT_API_KEY ?? "";
const sessionId = `smoke-${Date.now()}`;
const timestamp = new Date().toISOString();
const eventId = `evt-${Date.now()}`;

async function request(path, init) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...(init?.headers ?? {})
    },
    ...init
  });
  const bodyText = await response.text();
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }
  if (!response.ok) {
    throw new Error(`Smoke step failed for ${path}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

await request("/events", {
  method: "POST",
  body: JSON.stringify({
    session_id: sessionId,
    event: {
      event_id: eventId,
      session_id: sessionId,
      timestamp,
      type: "fact",
      title: "Smoke test fact",
      content: "smoke=ok",
      tags: ["smoke"],
      sources: ["smoke-script"],
      confidence: 0.9,
      freshness: "high",
      status: "active"
    }
  })
});

const search = await request("/search?q=smoke&type=fact");
if (!Array.isArray(search.results) || !search.results.some((item) => item.id === eventId)) {
  throw new Error("Smoke search did not return appended event");
}

await request("/snapshot/build", {
  method: "POST",
  body: JSON.stringify({ session_id: sessionId })
});

const snapshots = await request("/snapshots");
if (!Array.isArray(snapshots.snapshots) || snapshots.snapshots.length === 0) {
  throw new Error("Smoke snapshots list is empty");
}

await request("/snapshot/restore", {
  method: "POST",
  body: JSON.stringify({ id: snapshots.snapshots[0].id })
});

await request("/compact", { method: "POST", body: "{}" });

console.log(
  JSON.stringify({
    ok: true,
    base,
    sessionId,
    eventId,
    snapshotId: snapshots.snapshots[0].id
  })
);

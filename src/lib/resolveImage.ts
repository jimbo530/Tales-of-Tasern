const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

export function toHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return GATEWAYS[0] + uri.slice(7);
  return uri;
}

function ipfsCidUrls(uri: string): string[] {
  const cid = GATEWAYS.reduce<string | null>(
    (a, gw) => a ?? (uri.startsWith(gw) ? uri.slice(gw.length) : null), null
  );
  if (cid) return GATEWAYS.map((gw) => gw + cid);
  if (uri.startsWith("ipfs://")) return GATEWAYS.map((gw) => gw + uri.slice(7));
  return [uri];
}

async function fetchFirstOk(urls: string[]): Promise<Response> {
  return Promise.any(
    urls.map((url) =>
      fetch(url, { signal: AbortSignal.timeout(15000) }).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r;
      })
    )
  );
}

export async function resolveImage(metadataUri: string): Promise<string | null> {
  const urls = ipfsCidUrls(metadataUri);
  try {
    const res = await fetchFirstOk(urls);
    const meta = await res.json();
    if (!meta?.image) return null;
    return toHttp(meta.image as string);
  } catch {
    return null;
  }
}
